#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

seed_again=false
bootstrap_admin=false
for option in "$@"; do
  case "$option" in
    --seed)
      seed_again=true
      ;;
    --bootstrap-admin)
      bootstrap_admin=true
      ;;
    --help)
      printf 'Usage: %s [--seed] [--bootstrap-admin]\n' "$0"
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\nUsage: %s [--seed] [--bootstrap-admin]\n' "$option" "$0" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f .venv/bin/activate ]]; then
  printf 'Missing backend virtual environment: %s/.venv\n' "$PWD" >&2
  exit 1
fi
source .venv/bin/activate

export PYTHON_DOTENV_DISABLED=1
export DATABASE_URL="sqlite:///./mentor_match_local.db"

secret_dir="${XDG_CONFIG_HOME:-$HOME/.config}/mentor_match"
secret_file="$secret_dir/local_secret"
mkdir -p "$secret_dir"
if [[ ! -s "$secret_file" ]]; then
  (umask 077; python -c 'import secrets; print(secrets.token_urlsafe(48))' > "$secret_file")
fi
IFS= read -r MENTORMATCH_SECRET_KEY < "$secret_file"
if [[ ${#MENTORMATCH_SECRET_KEY} -lt 32 ]]; then
  printf 'The local signing key must be at least 32 characters: %s\n' "$secret_file" >&2
  exit 1
fi
export MENTORMATCH_SECRET_KEY

if [[ "$seed_again" == true || ! -s mentor_match_local.db ]]; then
  python -m app.seed_demo_data
else
  python -m app.init_db
fi

if [[ "$bootstrap_admin" == true ]]; then
  python -m app.bootstrap_admin
fi

exec uvicorn app.main:app --reload
