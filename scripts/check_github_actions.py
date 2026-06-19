import urllib.request
import json
import subprocess
import sys
import time

def get_token():
    try:
        p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        stdout, _ = p.communicate("protocol=https\nhost=github.com\n\n")
        for line in stdout.split('\n'):
            if line.startswith('password='):
                return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error getting token: {e}")
    return None

def fetch_api(url, token, is_log=False):
    class NoAuthRedirectHandler(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            new_req = urllib.request.Request(newurl)
            for key, val in req.headers.items():
                if key.lower() != 'authorization':
                    new_req.add_header(key, val)
            return new_req

    opener = urllib.request.build_opener(NoAuthRedirectHandler())
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {token}",
            "User-Agent": "Python-urllib",
            "Accept": "application/vnd.github.v3+json"
        }
    )
    try:
        res = opener.open(req)
        with res:
            if is_log:
                return res.read().decode('utf-8', errors='ignore')
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"⚠️ 讀取 {url} 失敗: {e}")
        return None

def main():
    token = get_token()
    if not token:
        print("❌ 無法取得 GitHub 憑證")
        sys.exit(1)

    # 取得本地 studio 倉庫最新 commit message
    try:
        commit_msg = subprocess.check_output(['git', '-C', 'studio', 'log', '-n', '1', '--format=%s'], text=True).strip()
        print(f"🔎 正在監控本地最新 Commit: \"{commit_msg}\" 的 GitHub Actions 狀態...")
    except Exception as e:
        print(f"⚠️ 無法取得本地 commit message: {e}")
        commit_msg = "feat: sync all scripts"

    url = "https://api.github.com/repos/azq1231/studio/actions/runs?per_page=5"
    
    max_checks = 25
    check_interval = 15
    
    for i in range(max_checks):
        data = fetch_api(url, token)
        if data:
            runs = data.get('workflow_runs', [])
            target_run = None
            
            # 尋找匹配最新 commit 訊息的 run (包含 in_progress 或是已完成的)
            for run in runs:
                msg = run.get('head_commit', {}).get('message', '')
                if commit_msg in msg or msg in commit_msg:
                    target_run = run
                    break
            
            if target_run:
                run_id = target_run['id']
                status = target_run['status']
                conclusion = target_run['conclusion']
                html_url = target_run['html_url']
                
                print(f"[{i+1}/{max_checks}] Run ID: {run_id} | 狀態: {status} | 結果: {conclusion}")
                
                if status == 'completed':
                    if conclusion == 'success':
                        print(f"\n🎉 [部屬與驗證成功] GitHub Actions: {target_run.get('name')} 執行成功！")
                        sys.exit(0)
                    else:
                        print(f"\n❌ [建置失敗] Actions {run_id} 執行結果為: {conclusion}")
                        # 下載並印出失敗 Job 的 Log
                        jobs_url = f"https://api.github.com/repos/azq1231/studio/actions/runs/{run_id}/jobs"
                        jobs_data = fetch_api(jobs_url, token)
                        if jobs_data:
                            for job in jobs_data.get('jobs', []):
                                if job['conclusion'] == 'failure':
                                    print(f"❌ 失敗的 Job: {job['name']}")
                                    log_url = f"https://api.github.com/repos/azq1231/studio/actions/jobs/{job['id']}/logs"
                                    log_data = fetch_api(log_url, token, is_log=True)
                                    if log_data:
                                        print("日誌最後 30 行:")
                                        lines = log_data.split('\n')
                                        for line in lines[-30:]:
                                            print(f"  {line}")
                        sys.exit(1)
            else:
                print("ℹ️ 尚未在 GitHub 上找到對應此 Commit 的 Runs...")
                
        time.sleep(check_interval)
        
    print("\n⚠️ 追蹤超時，請到 GitHub 網頁查看後續進度。")

if __name__ == "__main__":
    main()
