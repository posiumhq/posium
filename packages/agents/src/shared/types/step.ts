export interface SelectedElementInfo {
  xpath?: string;
  cssSelector?: string;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, string>;
}
