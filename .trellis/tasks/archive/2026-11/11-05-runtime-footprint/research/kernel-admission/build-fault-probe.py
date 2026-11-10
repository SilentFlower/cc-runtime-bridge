"""定向覆盖固定容器的结构拒绝路径，不执行官方程序。"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('runtime_image', Path(__file__).resolve().parents[5] / 'scripts/runtime/image.py')
image = importlib.util.module_from_spec(spec)
spec.loader.exec_module(image)
source = Path(sys.argv[1])
report = Path(sys.argv[2])
original = source.read_bytes()
source_hash = hashlib.sha256(original).hexdigest()
assert source_hash == '8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978'
sections = image.sections(original)
section_offset, section_bytes = sections['.bun']
graph = section_offset + 8
module_offset = struct.unpack_from('<I', original, section_offset + section_bytes - 40)[0]
first = graph + module_offset
name_offset, name_bytes = struct.unpack_from('<II', original, first)
records = []
with tempfile.TemporaryDirectory(prefix='ccrb-build-fault-') as directory:
    root = Path(directory)
    for name in ['source_hash', 'kernel', 'flags', 'pointer', 'path', 'duplicate', 'encoding']:
        raw = bytearray(original)
        if name == 'kernel':
            raw[sections['.text'][0]] ^= 1
        elif name == 'flags':
            struct.pack_into('<I', raw, section_offset + section_bytes - 20, 0)
        elif name == 'pointer':
            struct.pack_into('<I', raw, first + 8, 0xffffffff)
        elif name == 'path':
            prefix = b'/$bunfs/root/../'
            raw[graph + name_offset:graph + name_offset + name_bytes] = prefix + b'x' * (name_bytes - len(prefix))
        elif name == 'duplicate':
            struct.pack_into('<II', raw, first + 52, name_offset, name_bytes)
        elif name == 'encoding':
            raw[first + 48] = 3
        candidate = root / 'candidate'
        candidate.write_bytes(raw)
        expected = '0' * 64 if name == 'source_hash' else hashlib.sha256(raw).hexdigest()
        destination = root / name / 'modules'
        try:
            # 内层测试使用合成摘要进入结构边界；生产构建入口始终先固定官方 SHA256。
            image.extract(candidate, destination, expected)
        except ValueError as error:
            records.append({'case': name, 'rejected': True, 'error': str(error)})
        else:
            raise AssertionError('未拒绝故障：' + name)
    for name, value in [('empty_elf', b''), ('wrong_arch', b'\0' * 64)]:
        try:
            image.sections(value)
        except (ValueError, struct.error) as error:
            records.append({'case': name, 'rejected': True, 'error': str(error)})
        else:
            raise AssertionError('未拒绝 ELF 故障')
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
report.write_text(json.dumps({'success': True, 'source_unchanged': True, 'source_sha256': source_hash, 'cases': records, 'conditions': '只读原版；变异副本和部分提取内容全部在测试临时目录清理；结构测试不替代生产来源哈希准入'}, ensure_ascii=False, indent=2))
print(json.dumps({'success': True, 'rejected_cases': len(records)}))
