// Withdrawal must succeed before private bytes or metadata are removed.
export async function retirePublicationBeforeDelete({ ownerId, card, gateway, getSession, signal = AbortSignal.timeout(20000) }) {
  if (!ownerId.startsWith("account:")) return;
  const check = async () => {
    signal.throwIfAborted();
    const session = await getSession();
    if (`account:${session?.user?.id}` !== ownerId) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    signal.throwIfAborted();
  };
  await check();
  await gateway.retireCard(card.id, { signal });
  await check();
}
