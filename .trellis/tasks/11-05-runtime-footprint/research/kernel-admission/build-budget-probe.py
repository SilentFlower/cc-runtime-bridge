"""通过私有工具替身验证构建缺资源及预算失败，不能登记替身产物。"""
from pathlib import Path
import hashlib,json,os,subprocess,tempfile,time
project=Path('/root/project/cc-runtime-bridge')
source=Path('/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe')
manifest=json.loads((project/'runtime/claude-293.manifest.json').read_text())
resource=next(name.split('/$bunfs/root/',1)[1] for name in manifest['closure']['mapped_modules'] if name.endswith('.zst'))
records=json.loads((project/'artifacts/build-guards.json').read_text())['cases']
with tempfile.TemporaryDirectory(prefix='ccrb-build-guards-') as temporary:
 root=Path(temporary);(root/'home').mkdir()
 for kind in ['oversize']:
  bin_dir=root/kind;bin_dir.mkdir()
  if kind=='missing_resource':
   wrapper=bin_dir/'python3'
   wrapper.write_text('#!/usr/bin/python3\nimport pathlib,subprocess,sys\nr=subprocess.run(["/usr/bin/python3",*sys.argv[1:]])\nif r.returncode==0 and len(sys.argv)>4 and sys.argv[2]=="extract": (pathlib.Path(sys.argv[4])/'+repr(resource)+').unlink()\nraise SystemExit(r.returncode)\n')
  else:
   wrapper=bin_dir/'gcc'
   wrapper.write_text('#!/usr/bin/python3\nimport pathlib,subprocess,sys\nif sys.argv[1:]==["-dumpfullversion"]: raise SystemExit(subprocess.run(["/usr/bin/gcc",*sys.argv[1:]]).returncode)\noutput=pathlib.Path(sys.argv[sys.argv.index("-o")+1])\nwith output.open("wb") as stream: stream.truncate(27933053)\n')
  wrapper.chmod(0o755)
  target=root/(kind+'-output')
  env={'PATH':str(bin_dir)+':'+os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(root/'home'),'LANG':'C.UTF-8'}
  started=time.monotonic()
  run=subprocess.run(['/root/.bun/bin/bun',str(project/'scripts/build-runtime.ts'),'--source',str(source),'--out',str(target),'--sevenzip','/tmp/ccrb-compact-feasibility-tsy0tloy/sevenzip/7zz','--sdk','/tmp/ccrb-pinned-sdk-26.05.tar.xz'],cwd=project,env=env,capture_output=True,text=True,timeout=300)
  lines=[line for line in run.stderr.splitlines() if line.startswith('error: ')]
  assert run.returncode!=0 and not target.exists() and not Path(str(target)+'.manifest.json').exists()
  if kind=='oversize':assert any('超出体积目标' in line for line in lines),lines
  records.append({'case':kind,'rejected':True,'exit_code':run.returncode,'final_output_absent':True,'errors':lines,'seconds':time.monotonic()-started})
  (project/'artifacts/build-guards.json').write_text(json.dumps({'cases':records},ensure_ascii=False,indent=2))
assert hashlib.sha256(source.read_bytes()).hexdigest()=='8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978'
print(json.dumps({'success':True,'cases':records},ensure_ascii=False))
