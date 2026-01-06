/*  HTML Layout JSON > After Effects (ExtendScript .jsx)
    ---------------------------------------------------
    ? ������ ����������, ���-�����, ���� (text / image / shape) �� JSON
    ? ��������� ����������� (������)
    ? ��������� ��������� ���������� �� �������� (top-left) � AE
    ? ������ precomp ��� group.needsPrecomp ��� ��� clip.enabled
    ? ������ shape layer ��� clip �� bbox, ������������ borderRadius (���������� ����)
    ? �����: font/size/leading/tracking/color + box text �� bbox
    ? �����������:
       - assetType:"file" + src:"/path/to/file.png" > ����������� footage
       - assetType:"url" > ������ placeholder solid + ����� URL � Comment

    ��� ���������:
    File > Scripts > Run Script File� > ������� ���� .jsx > ������� JSON

    ����������:
    - ���� ������ ��� � ������� AE � ����� fallback �� ���������.
    - ��� URL-����������� AE ��� ��������� �� ����� ��� ������� ������.
*/

function artifact() {
  // Enable verbose logs in the AE console.
  var AE2_DEBUG = true;
  //@include "../Global Function/Modules/patch.array.js"
  //@include "../Global Function/Modules/patch.object.js"
  //@include "../Global Function/Modules/patch.string.js"
  //@include "../Global Function/inlineJSON.js"
  //@include "../Global Function/JSON2.js"
  //@include "./html-to-ae/config-entry.jsx"
  //@include "./html-to-ae/core.jsx"
  //@include "./html-to-ae/layer-creators.jsx"
  //@include "./html-to-ae/svg.jsx"
  //@include "./html-to-ae/transforms.jsx"
  //@include "./html-to-ae/clip-shapes.jsx"
  //@include "./html-to-ae/styles.jsx"
  //@include "./html-to-ae/import.jsx"
  //@include "./html-to-ae/helpers.jsx"
}

artifact();
