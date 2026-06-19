import urllib.request
import json
import subprocess
import sys

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
    # 客製 RedirectHandler 避免將 Authorization Header 洩漏到第三方儲存服務 (S3/GCS) 導致 403 錯誤
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

    run_id = "27838552845"
    url = f"https://api.github.com/repos/azq1231/studio/actions/runs/{run_id}/jobs"
    
    data = fetch_api(url, token)
    if data:
        jobs = data.get('jobs', [])
        for job in jobs:
            job_id = job['id']
            print(f"🔎 正在獲取 Job {job_id} 的 Logs...")
            log_url = f"https://api.github.com/repos/azq1231/studio/actions/jobs/{job_id}/logs"
            log_data = fetch_api(log_url, token, is_log=True)
            if log_data:
                print("="*80)
                print(f"🚀 Job {job_id} ({job['name']}) 最後 40 行日誌：")
                print("="*80)
                lines = log_data.split('\n')
                print('\n'.join(lines[-40:]))
                print("="*80)
            else:
                print("❌ 無法取得 Logs")
    else:
        print("❌ 無法取得 Jobs 資訊")

if __name__ == "__main__":
    main()
