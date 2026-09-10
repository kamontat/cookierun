import { need, renderSidebar, renderToolList } from "./shared/chrome.ts";

renderSidebar(need("sidebar"), null);
renderToolList(need("tools"));
