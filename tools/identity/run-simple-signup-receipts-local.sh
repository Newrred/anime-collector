#!/usr/bin/env bash
# Disposable local PostgreSQL only. No environment credentials or hosted URL.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-signup-receipts.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55456 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55456 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in 20261009130000_simple_signup_declarations.sql 20261009143000_simple_signup_admission.sql 20261010170000_simple_signup_receipts.sql; do
 "${psql[@]}" -f "$root/supabase/migrations/$migration" >> "$work/setup.log" 2>&1 || { cat "$work/setup.log"; exit 1; }
done
# Parse SQL constants without importing/running the remote configuration tool or reading env files.
documents_sql="$(python3 - "$root/tools/identity/configure-simple-signup-test.py" <<'PY'
import ast
import pathlib
import sys

tree = ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
blocks = {}
for node in ast.walk(tree):
    if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
        continue
    test = node.test
    if not (isinstance(test.left, ast.Attribute) and isinstance(test.left.value, ast.Name)
            and test.left.value.id == 'args' and test.left.attr == 'action'
            and len(test.ops) == len(test.comparators) == 1 and isinstance(test.comparators[0], ast.Constant)):
        continue
    tag = (type(test.ops[0]).__name__, test.comparators[0].value)
    if tag not in [('NotEq', 'inspect'), ('Eq', 'documents')]:
        continue
    assert len(node.body) == 1 and isinstance(node.body[0], ast.Expr), 'SQL extraction contract changed'
    call = node.body[0].value
    assert isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute), 'Expected sql.append'
    assert isinstance(call.func.value, ast.Name) and call.func.value.id == 'sql' and call.func.attr == 'append'
    assert len(call.args) == 1 and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str)
    blocks[tag] = call.args[0].value
assert len(blocks) == 2, 'Missing fixed documents SQL or shared mutation guard'
print(blocks[('NotEq', 'inspect')] + '\n' + blocks[('Eq', 'documents')])
PY
)"
"${psql[@]}" -v documents_sql="$documents_sql" -f "$root/tools/identity/simple-signup-receipts-contract.sql" > "$work/results.log" 2>&1 || { cat "$work/results.log"; exit 1; }
grep 'PASS:' "$work/results.log"
python3 - "$work/results.log" <<'PY'
import json
import pathlib
import sys

previous = []
for line in pathlib.Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if line.startswith('{'):
        row = json.loads(line)
        if 'previousPolicy' in row:
            previous.append(row['previousPolicy'])
assert len(previous) == 2, 'Each successful staging must emit its previous policy'
assert previous[0]['version'] == 'simple-signup-2026-10-09' and previous[0]['enabled'] and previous[0]['serverAdmission']
assert previous[1]['version'] == 'simple-signup-2026-10-10-test' and not previous[1]['enabled'] and not previous[1]['serverAdmission']
assert previous[0]['countries'] == previous[1]['countries'], 'Printed country policy changed'
print('PASS: documents action emits the previous policy before both initial staging and safe retry')
PY
echo 'LOCAL PostgreSQL synthetic accounts only; no hosted Auth, real deletion or policy activation.'
