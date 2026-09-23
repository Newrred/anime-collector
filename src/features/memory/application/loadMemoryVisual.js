export async function loadMemoryVisual(bundle, runtime) {
  const { asset, title } = bundle;
  if (asset?.designSpec) return { kind: "SYSTEM_DESIGN", designSpec: asset.designSpec };
  if (asset?.imageType === "CATALOG_COVER") {
    const cover = await runtime.resolveCatalogCover(asset.catalogCoverRef).catch(() => null);
    return cover?.publicUrl ? { kind: "IMAGE", src: cover.publicUrl, alt: `${title.displayTitle} 메모리 카드` } : { kind: "MISSING" };
  }
  const src = asset?.localRef ? await runtime.getPreview(asset.localRef).catch(() => null) : null;
  return src ? { kind: "IMAGE", src, alt: title.displayTitle } : { kind: "MISSING" };
}
