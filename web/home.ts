import { need, renderSidebar, renderToolList } from "./shared/chrome.ts";
import { renderThemeControl } from "./shared/theme.ts";

renderSidebar(need("sidebar"), null);
renderThemeControl(need("theme"));
renderToolList(need("tools"));
