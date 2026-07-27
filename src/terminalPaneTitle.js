export function terminalPaneTitle(name, dynamicTitle) {
  return {
    label: name,
    tooltip: dynamicTitle && dynamicTitle !== name ? `${name} · ${dynamicTitle}` : name,
  };
}
