"""仅在临时目录压缩可行性探针，记录最终文件而非中间构建 Blob。"""
import hashlib,json,pathlib,shutil,subprocess,tempfile,time
ROOT=pathlib.Path('/tmp/ccrb-compact-feasibility-tsy0tloy')
SOURCE=ROOT/'native-api-files'
PACKED=ROOT/'native-api-files-packed'
TOOL=pathlib.Path('/tmp/ccrb-footprint-study-i7_zyco2/upx')
assert hashlib.sha256(TOOL.read_bytes()).hexdigest()=='39bbf81cb4c56ce3e2e13a1755a31ec4970e33f061db8e214e9fac59354fc9aa'
print('开始压缩已能导入固定接口的研究探针',flush=True)
start=time.monotonic()
run=subprocess.run([str(TOOL),'--best','--lzma','-o',str(PACKED),str(SOURCE)],capture_output=True,text=True,timeout=300)
record={'command':[str(TOOL),'--best','--lzma','-o',str(PACKED),str(SOURCE)],'exit_code':run.returncode,'compression_seconds':time.monotonic()-start,'stdout':run.stdout[-2000:],'stderr':run.stderr[-2000:]}
if run.returncode==0:
 record.update({'source_bytes':SOURCE.stat().st_size,'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'packed_bytes':PACKED.stat().st_size,'packed_sha256':hashlib.sha256(PACKED.read_bytes()).hexdigest()})
 check=subprocess.run([str(TOOL),'-t',str(PACKED)],capture_output=True,text=True,timeout=60)
 record['upx_test']={'exit_code':check.returncode,'stdout':check.stdout[-1000:],'stderr':check.stderr[-1000:]}
 with tempfile.TemporaryDirectory(prefix='ccrb-roundtrip-') as temporary:
  restored=pathlib.Path(temporary)/'restored'
  check=subprocess.run([str(TOOL),'-d','-o',str(restored),str(PACKED)],capture_output=True,text=True,timeout=60)
  record['roundtrip']={'exit_code':check.returncode,'restored_sha256':hashlib.sha256(restored.read_bytes()).hexdigest() if restored.exists() else None}
 samples=[]
 for index in range(5):
  with tempfile.TemporaryDirectory(prefix='ccrb-packed-probe-home-') as home:
   env={'HOME':home,'PATH':'/usr/bin:/bin','CLAUDE_CONFIG_DIR':home+'/config','CCRB_NATIVE_PROBE':'1'}
   start=time.monotonic();probe=subprocess.run(['unshare','--net',str(PACKED)],env=env,capture_output=True,text=True,timeout=30)
   samples.append({'iteration':index,'seconds':time.monotonic()-start,'exit_code':probe.returncode,'stdout':probe.stdout[-1200:],'stderr':probe.stderr[-1200:]})
 record['function_import_samples']=samples
(ROOT/'native-files-pack-probe.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
print(json.dumps(record,ensure_ascii=False),flush=True)
