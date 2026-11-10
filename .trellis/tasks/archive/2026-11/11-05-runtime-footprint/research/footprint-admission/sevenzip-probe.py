"""核对固定同内核产物的 BCJ2 打包收益，不把归档当作可执行运行时。"""
from pathlib import Path
import hashlib,json,subprocess,tempfile,time
root=Path('/tmp/ccrb-compact-feasibility-tsy0tloy')
tool=root/'sevenzip/7zz';source=root/'native-api-files';target=root/'native-api-bcj2.7z'
assert hashlib.sha256(tool.read_bytes()).hexdigest()=='d32657a7a0e4cdc0a8aa57cafe474746944d76e861e753e9c902b9c9356fa886'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='3ad0d4b919b30dae2de91a6152b5ffb53315204e5792e64137bca95dd5d2391f'
args=[str(tool),'a','-t7z','-mx=9','-m0=BCJ2','-m1=LZMA2:d=128m:fb=273','-m2=LZMA2:d=16m','-m3=LZMA2:d=16m','-mb0:1','-mb0s1:2','-mb0s2:3','-mmt=1','-mtm=off','-bsp0',str(target),str(source)]
with tempfile.TemporaryDirectory(prefix='ccrb-bcj2-home-') as home:
 env={'HOME':home,'PATH':'/usr/bin:/bin'};start=time.monotonic()
 run=subprocess.run(['unshare','--net']+args,env=env,capture_output=True,text=True,timeout=240)
 record={'command':args,'exit_code':run.returncode,'seconds':time.monotonic()-start,'archive_bytes':target.stat().st_size if target.exists() else None,'stdout':run.stdout[-1800:],'stderr':run.stderr[-1800:]}
 if run.returncode==0:
  run=subprocess.run(['unshare','--net',str(tool),'t',str(target)],env=env,capture_output=True,text=True,timeout=60)
  record['test']={'exit_code':run.returncode,'stdout':run.stdout[-1500:],'stderr':run.stderr[-1000:]}
  start=time.monotonic();proc=subprocess.Popen(['unshare','--net',str(tool),'e','-so',str(target)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  digest=hashlib.sha256();length=0
  while True:
   chunk=proc.stdout.read(1048576)
   if not chunk:break
   digest.update(chunk);length+=len(chunk)
  stderr=proc.stderr.read();code=proc.wait(timeout=30)
  record['decode']={'exit_code':code,'seconds':time.monotonic()-start,'bytes':length,'sha256':digest.hexdigest(),'stderr':stderr.decode(errors='replace')[-1000:]}
(root/'native-bcj2-probe.json').write_text(json.dumps(record,indent=2));print(json.dumps(record))
