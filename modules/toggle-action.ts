import { defineWxtModule } from "wxt/modules"

export default defineWxtModule({
  name: "toggle-action",
  setup(wxt) {
    wxt.hooks.hook("build:manifestGenerated", (_wxt, manifest) => {
      if (manifest.action) {
        delete (manifest.action as { default_popup?: string }).default_popup
        manifest.action.default_title = "Workmate AI"
      }
    })
  },
})
