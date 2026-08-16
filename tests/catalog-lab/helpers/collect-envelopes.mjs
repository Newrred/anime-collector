export async function collectEnvelopes(adapter, input) {
  const rows = [];
  for await (const envelope of adapter.collect(input)) rows.push(envelope);
  return rows;
}
