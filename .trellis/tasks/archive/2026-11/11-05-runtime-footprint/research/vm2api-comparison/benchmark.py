"""在无外网命名空间比较 vm2api 原生循环的启动、就绪和回环请求耗时。"""

import hashlib
import http.server
import json
import os
from pathlib import Path
import queue
import signal
import statistics
import subprocess
import threading
import time


ROOT = Path('/tmp/ccrb-vm2api-study-542b7872')
META = json.loads((ROOT / 'study.json').read_text())
REQUESTS = []


class Mock(http.server.BaseHTTPRequestHandler):
    """只在本地回环地址返回合成上游响应。"""

    def do_POST(self):
        """处理合成消息请求，不接入真实供应商。

        @return 完成当前 HTTP 响应。
        """
        length = int(self.headers.get('content-length', '0'))
        if length > 2 * 1024 * 1024:
            self.send_error(413)
            return
        raw = self.rfile.read(length)
        if not self.path.startswith('/v1/messages'):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{}')
            return
        body = json.loads(raw)
        REQUESTS.append({'at': time.monotonic(), 'bytes': len(raw), 'model': body['model']})
        message = {'id': 'msg_local', 'type': 'message', 'role': 'assistant',
                   'model': body['model'], 'content': [], 'stop_reason': None,
                   'stop_sequence': None, 'usage': {'input_tokens': 1, 'output_tokens': 0}}
        events = [
            {'type': 'message_start', 'message': message},
            {'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}},
            {'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'text_delta', 'text': 'ok'}},
            {'type': 'content_block_stop', 'index': 0},
            {'type': 'message_delta', 'delta': {'stop_reason': 'end_turn', 'stop_sequence': None},
             'usage': {'output_tokens': 1}},
            {'type': 'message_stop'},
        ]
        data = ''.join('event: ' + item['type'] + '\ndata: ' + json.dumps(item) + '\n\n'
                       for item in events).encode()
        self.send_response(200)
        self.send_header('content-type', 'text/event-stream')
        self.send_header('content-length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args):
        """关闭与性能无关的 HTTP 访问日志。

        @param _args HTTP 日志参数。
        @return 不输出内容。
        """


def child_env(name, base_url):
    """为每个新进程准备独立 HOME 和环境白名单。

    @param name 本次试验名称。
    @param base_url 同一网络命名空间的模拟上游地址。
    @return 不包含宿主凭据或代理的子进程环境。
    """
    home = ROOT / name
    config = home / 'config'
    config.mkdir(parents=True)
    return {'HOME': str(home), 'CLAUDE_CONFIG_DIR': str(config),
            'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'LANG': 'C.UTF-8', 'ANTHROPIC_API_KEY': 'offline-fixture-key',
            'ANTHROPIC_BASE_URL': base_url, 'NO_PROXY': '127.0.0.1,localhost',
            'DISABLE_TELEMETRY': '1', 'DISABLE_ERROR_REPORTING': '1',
            'DISABLE_AUTOUPDATER': '1', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1'}


def memory(pid):
    """读取本次进程已观测到的内存峰值。

    @param pid 由本脚本创建的进程编号。
    @return RSS 和峰值 RSS，单位为字节。
    """
    fields = {}
    for line in (Path('/proc') / str(pid) / 'status').read_text().splitlines():
        key, _, value = line.partition(':')
        if key in ('VmRSS', 'VmHWM'):
            fields[key] = int(value.split()[0]) * 1024
    return fields


def stop(child):
    """清理本脚本创建的独立进程组。

    @param child 本次试验的子进程。
    @return 进程已经退出。
    """
    if child.poll() is None:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    child.wait(timeout=10)


def native_trial(label, binary, trial, base_url):
    """测量真实原生循环的就绪及首次和复用请求。

    @param label 构建名称。
    @param binary 固定程序文件。
    @param trial 独立新进程样本编号。
    @param base_url 本地模拟上游地址。
    @return 带有运行条件和完成状态的计时记录。
    """
    env = child_env(label + '-native-' + str(trial), base_url)
    env['CLAUDE_CODE_NATIVE_SLOTS'] = '20'
    frames = queue.Queue()
    errors = []
    start = time.monotonic()
    child = subprocess.Popen([str(binary)], env=env, cwd=env['HOME'], stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                             bufsize=1, start_new_session=True)

    def read_stdout():
        """持续排空协议输出，按接收时刻计时。"""
        for line in child.stdout:
            try:
                frames.put((time.monotonic(), json.loads(line)))
            except ValueError:
                errors.append(line[:500])

    def read_stderr():
        """排空诊断通道，避免管道背压改变启动耗时。"""
        for line in child.stderr:
            if len(errors) < 30:
                errors.append(line[:500])

    threading.Thread(target=read_stdout, daemon=True).start()
    threading.Thread(target=read_stderr, daemon=True).start()
    record = {'variant': label, 'trial': trial, 'pid': child.pid, 'slots': 20}
    try:
        slot_ids = []
        host_ready = None
        deadline = start + 25
        while len(slot_ids) < 20:
            at, frame = frames.get(timeout=max(0.001, deadline - time.monotonic()))
            if frame.get('type') == 'host_ready':
                host_ready = frame
                record['host_ready_ms'] = round((at - start) * 1000, 3)
            if frame.get('type') == 'slot_ready':
                slot_ids.append(frame['slot_id'])
                record['all_slots_ready_ms'] = round((at - start) * 1000, 3)
        if not host_ready or host_ready.get('slots') != 20 or len(set(slot_ids)) != 20:
            raise RuntimeError('槽位握手不符合源码定义')
        record['memory_at_ready'] = memory(child.pid)
        record['host_ready'] = host_ready
        jobs = []
        for job_index in range(6):
            job_id = label + '-' + str(trial) + '-' + str(job_index)
            request = {'type': 'job_start', 'job_id': job_id, 'slot_id': slot_ids[0],
                       'request': {'model': 'claude-opus-5-5', 'max_tokens': 128, 'stream': True,
                                   'output_config': {'effort': 'low'},
                                   'messages': [{'role': 'user', 'content': 'Print integers.'}]}}
            before = len(REQUESTS)
            sent = time.monotonic()
            child.stdin.write(json.dumps(request) + '\n')
            child.stdin.flush()
            first_text = None
            deadline = sent + 25
            while True:
                at, frame = frames.get(timeout=max(0.001, deadline - time.monotonic()))
                if frame.get('job_id') != job_id:
                    continue
                event = frame.get('event', {})
                if frame.get('type') == 'stream_event' and event.get('type') == 'content_block_delta':
                    first_text = first_text if first_text is not None else at
                if frame.get('type') in ('job_done', 'job_error'):
                    if frame['type'] != 'job_done':
                        raise RuntimeError(json.dumps(frame))
                    jobs.append({'job_index': job_index, 'terminal_ms': round((at - sent) * 1000, 3),
                                 'first_text_ms': None if first_text is None else round((first_text - sent) * 1000, 3),
                                 'upstream_requests': len(REQUESTS) - before})
                    break
            if jobs[-1]['upstream_requests'] != 1 or jobs[-1]['first_text_ms'] is None:
                raise RuntimeError('合成请求次数或文本响应不符合预期')
            # 计时之外留出一次事件循环收尾，复用同一个槽位和进程。
            time.sleep(0.01)
        record['jobs'] = jobs
        record['memory_after_jobs'] = memory(child.pid)
        record['process_alive_after_jobs'] = child.poll() is None
        record['success'] = True
    except Exception as error:
        record.update({'success': False, 'error': repr(error), 'diagnostics': errors[-15:],
                       'exit_code': child.poll()})
    finally:
        stop(child)
    return record


def main():
    """运行串行对照，所有子进程共享无外网的回环命名空间。

    @return 完成后写入完整采样和摘要。
    """
    subprocess.run(['/usr/sbin/ip', 'link', 'set', 'lo', 'up'], check=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base_url = 'http://127.0.0.1:' + str(server.server_port)
    variants = [('packed', Path(META['packed_path'])), ('unpacked', Path(META['unpacked_path']))]
    records = {'conditions': {'network': 'unshare --net，只有回环启用', 'trials_per_variant': 5,
                              'slots_per_process': 20, 'credentials': '合成 API key，独立空 HOME',
                              'file_page_cache': '未清理，不等同于冷磁盘启动',
                              'requests': '每个进程首轮加五轮复用，本地合成 SSE，无真实模型'},
               'versions': [], 'native': []}
    try:
        for label, binary in variants:
            for trial in range(5):
                env = child_env(label + '-version-' + str(trial), base_url)
                start = time.monotonic()
                result = subprocess.run([str(binary), '--version'], env=env, cwd=env['HOME'],
                                        capture_output=True, text=True, timeout=25)
                records['versions'].append({'variant': label, 'trial': trial,
                                            'duration_ms': round((time.monotonic() - start) * 1000, 3),
                                            'exit_code': result.returncode, 'stdout': result.stdout,
                                            'stderr': result.stderr})
        for label, binary in variants:
            for trial in range(5):
                record = native_trial(label, binary, trial, base_url)
                records['native'].append(record)
                (ROOT / 'benchmark-results.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
                print(json.dumps(record, ensure_ascii=False), flush=True)
                if not record['success']:
                    break
        summary = {}
        for label, _binary in variants:
            version = [row['duration_ms'] for row in records['versions'] if row['variant'] == label]
            native = [row for row in records['native'] if row['variant'] == label and row['success']]
            if native:
                summary[label] = {
                    'successful_trials': len(native), 'version_median_ms': statistics.median(version),
                    'all_slots_ready_median_ms': statistics.median(row['all_slots_ready_ms'] for row in native),
                    'first_request_median_ms': statistics.median(row['jobs'][0]['terminal_ms'] for row in native),
                    'warm_request_median_ms': statistics.median(job['terminal_ms'] for row in native for job in row['jobs'][1:]),
                    'max_ready_hwm_bytes': max(row['memory_at_ready']['VmHWM'] for row in native),
                    'max_after_jobs_hwm_bytes': max(row['memory_after_jobs']['VmHWM'] for row in native),
                }
        records['summary'] = summary
        records['total_mock_requests'] = len(REQUESTS)
        (ROOT / 'benchmark-results.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'summary': summary, 'total_mock_requests': len(REQUESTS)}, ensure_ascii=False), flush=True)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
