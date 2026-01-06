/*  HTML Layout JSON > Photoshop (ExtendScript .jsx)
    ------------------------------------------------
    Creates a PSD layer/folder structure from the exported JSON.
    Run in Photoshop via File > Scripts > Browse.
*/

function artifact() {
  // Enable verbose logs in the ExtendScript console.
  var PS2_DEBUG = true;
  //@include "../Global Function/Modules/patch.array.js"
  //@include "../Global Function/Modules/patch.object.js"
  //@include "../Global Function/Modules/patch.string.js"
  //@include "../Global Function/inlineJSON.js"
  //@include "../Global Function/JSON2.js"
  //@include "./html-to-ps/config-entry.jsx"
  //@include "./html-to-ps/core.jsx"
  //@include "./html-to-ps/layer-creators.jsx"
  //@include "./html-to-ps/svg.jsx"
  //@include "./html-to-ps/transforms.jsx"
  //@include "./html-to-ps/clip-shapes.jsx"
  //@include "./html-to-ps/styles.jsx"
  //@include "./html-to-ps/import.jsx"
  //@include "./html-to-ps/helpers.jsx"
}

artifact();
