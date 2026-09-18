export function chromeManifest(manifest) {
  const out = structuredClone(manifest);
  delete out.background.scripts;
  return out;
}

export function firefoxManifest(manifest) {
  const out = structuredClone(manifest);
  out.background = { scripts: out.background.scripts || [] };
  return out;
}