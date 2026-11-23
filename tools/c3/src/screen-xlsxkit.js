/* C3 kit: xlsx (v371). A real Excel workbook (.xlsx), written on the phone with nothing fetched: the sheets as Office Open
   XML, stored in a zip (no compression, each part with its CRC-32). Chad, 28 Oct 2026: "Full Menu w a drop down havin
   selections day week month ... that opens a xcel sheet with full menu and items ... make it printalbe shareable and
   exportable". Each sheet has its header row frozen and filtered, columns sized, and is set up to print: landscape,
   one page wide, the header row repeated on every page, the title and page number in the margins.
   C3.xlsx.blob({title, sheets: [{name, cols: [{h: 'Header', w: 14, num: true}], rows: [{s: 'day'|'meal'|'item'|'note', c: [...]}]}]})
   C3.xlsx.save(book, filename)    download it (a computer, a phone browser)
   C3.xlsx.share(book, filename)   the phone's share sheet with the file itself (Excel, Numbers, Files, Mail, Print),
                                   in the app through RUN.shareFile, in a browser through the Web Share API; else save */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var X = C3.xlsx = {};
  var MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  X.mime = MIME;

  /* ---------- the zip: stored parts, CRC-32, UTF-8 names ---------- */
  var CRC = (function(){ var t = new Uint32Array(256); for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8){ var c = 0xFFFFFFFF; for(var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = function(s){ return new TextEncoder().encode(s); };
  function zip(files){
    var d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
        date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var parts = [], central = [], off = 0;
    files.forEach(function(f){
      var name = enc(f.name), data = enc(f.data), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function(a, b){ return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, off, true); e.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), {type: MIME});
  }

  /* ---------- the workbook ---------- */
  /* text in XML: escaped, and without the control characters XML does not allow */
  function xe(s){ return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i){ var s = ''; i++; while(i > 0){ var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /* the styles, by row kind: 1 header, 2 bold, 3 bold number, 4 number, 5 quiet text, 6 quiet number, 7 day text, 8 day number */
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.0"/></numFmts>' +
    '<fonts count="4"><font><sz val="11"/><color rgb="FF14161C"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF14161C"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><sz val="10.5"/><color rgb="FF4A4F5C"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF0B3D2A"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFDDF8EB"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="medium"><color rgb="FF1ED88A"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="14"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>' +
      /* 9 to 12: the same text, centered (a short word in its own column, so it never reads as part of the number beside it) */
      '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      /* 13: a quiet number with one decimal (an ingredient's protein, carbs, fat) */
      '<xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  var KIND = {day: [7, 8, 9], meal: [2, 3, 10], item: [5, 6, 11], note: [5, 6, 11], total: [2, 3, 10], plain: [0, 4, 12]};
  function cellXML(ref, v, sText, sNum){
    if(v == null || v === '') return '';
    if(typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + (sNum === 6 && v % 1 !== 0 ? 13 : sNum) + '"><v>' + v + '</v></c>';
    return '<c r="' + ref + '" s="' + sText + '" t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>';
  }
  function sheetXML(sh, title){
    var cols = sh.cols, last = col(cols.length - 1);
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + last + (sh.rows.length + 1) + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + cols.map(function(c, i){ return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 12) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' +
      '<row r="1" ht="20" customHeight="1">' + cols.map(function(c, i){ return cellXML(col(i) + '1', c.h, 1, 1); }).join('') + '</row>';
    sh.rows.forEach(function(r, n){
      var k = KIND[r.s] || KIND.plain, rn = n + 2;
      x += '<row r="' + rn + '">' + r.c.map(function(v, i){ return cellXML(col(i) + rn, v, cols[i] && cols[i].center ? k[2] : k[0], k[1]); }).join('') + '</row>';
    });
    return x + '</sheetData><autoFilter ref="A1:' + last + (sh.rows.length + 1) + '"/>' +
      '<printOptions gridLines="0"/><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
      '<headerFooter><oddHeader>&amp;L&amp;"Calibri,Bold"' + xe(title).replace(/&amp;/g, '&amp;&amp;') + '&amp;Rformed fit</oddHeader><oddFooter>&amp;Lapp.formedlabs.co&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>';
  }
  /* sheet names: 31 characters, none of \ / ? * [ ] : */
  var sheetName = function(s, i){ return (String(s || 'Sheet ' + (i + 1)).replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 31)) || 'Sheet ' + (i + 1); };
  X.blob = function(book){
    var sheets = (book.sheets || []).filter(function(s){ return s && s.cols && s.cols.length; });
    if(!sheets.length) sheets = [{name: 'Sheet 1', cols: [{h: book.title || 'formed fit', w: 40}], rows: []}];
    var names = sheets.map(function(s, i){ return sheetName(s.name, i); });
    var files = [
      {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        sheets.map(function(s, i){ return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>'},
      {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'},
      {name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + xe(book.title || 'formed fit') + '</dc:title><dc:creator>formed fit</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>'},
      {name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>formed fit</Application></Properties>'},
      {name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' + names.map(function(n, i){ return '<sheet name="' + xe(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        '<definedNames>' + names.map(function(n, i){ var q = "'" + n.replace(/'/g, "''") + "'"; return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + xe(q) + '!$A$1:$' + col(sheets[i].cols.length - 1) + '$' + (sheets[i].rows.length + 1) + '</definedName>' +
          '<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">' + xe(q) + '!$1:$1</definedName>'; }).join('') + '</definedNames></workbook>'},
      {name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function(s, i){ return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
      {name: 'xl/styles.xml', data: STYLES}
    ];
    sheets.forEach(function(s, i){ files.push({name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXML(s, (book.title || '') + (sheets.length > 1 ? ' · ' + names[i] : ''))}); });
    return zip(files);
  };

  /* ---------- out of the app ---------- */
  var toast = function(m, bad){ try{ if(C3.yd && C3.yd.toast) C3.yd.toast(m, bad); else if(typeof say === 'function') say(m); }catch(e){} };
  var native = function(){ return !/^https?:$/.test(location.protocol); };
  X.save = function(book, filename){
    var b = X.blob(book), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 8000);
    toast('Saved <b>' + C3.h.esc(filename) + '</b>. Open it in Excel, Numbers or Google Sheets.');
    return b;
  };
  function b64(blob){ return new Promise(function(ok, no){ var r = new FileReader(); r.onload = function(){ ok(String(r.result).split(',')[1] || ''); }; r.onerror = no; r.readAsDataURL(blob); }); }
  X.share = function(book, filename){
    var b = X.blob(book), title = book.title || 'formed fit';
    /* the app: the file is written to the phone's cache and the share sheet gets the file itself */
    if(native() && window.RUN && RUN.shareFile){
      return b64(b).then(function(data){ return RUN.shareFile({filename: filename, base64: data, mime: MIME, title: title}); })
        .catch(function(e){ if(!e || !/cancel/i.test(String(e.message || e))) toast('Could not open the share sheet. Try again.', true); });
    }
    var file = null; try{ file = new File([b], filename, {type: MIME}); }catch(e){}
    var can = false; try{ can = !!(file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})); }catch(e){}
    if(can) return Promise.resolve(navigator.share({files: [file], title: title})).catch(function(e){ if(!e || e.name !== 'AbortError') X.save(book, filename); });
    X.save(book, filename);
    return Promise.resolve();
  };
})();
