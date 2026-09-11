import "#components/site-nav.ts";

import { need, renderToolList } from "./shared/chrome.ts";

renderToolList(need("tools"));
