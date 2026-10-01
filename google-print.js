(function () {
  function filterText(active) {
    const values = [];

    active.querySelectorAll('input,select').forEach((el) => {
      if (el.type === 'file' || el.type === 'hidden') return;

      const value = el.tagName === 'SELECT'
        ? (el.selectedOptions?.[0]?.textContent || '')
        : String(el.value || '').trim();

      if (value) values.push(value);
    });

    return values.length ? values.join(' — ') : 'كل البيانات';
  }

  function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }

  function cleanFilePart(value, fallback) {
    const text = String(value || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[\/:*?"<>|]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text || fallback;
  }

  function getScreenTitle(active) {
    const heading = active?.querySelector('h1,h2,h3');

    const title = String(
      heading?.textContent ||
      active?.id ||
      'تقرير'
    )
      .replace(/شاشة/g, '')
      .replace(/screen/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanFilePart(title, 'تقرير');
  }

  function getOfficerName(active) {
    const ids = [
      'collectionOfficer',
      'clientsOfficer',
      'specialistOfficer',
      'searchOfficer',
      'loginOfficerUser'
    ];

    for (const id of ids) {
      const el =
        active?.querySelector('#' + id) ||
        document.getElementById(id);

      const value =
        el?.value ||
        el?.selectedOptions?.[0]?.textContent ||
        '';

      if (String(value).trim()) {
        return cleanFilePart(value, 'الكل');
      }
    }

    return 'الكل';
  }

  function getFilterDateText(active) {
    const datePairs = [
      ['clientsFrom', 'clientsTo'],
      ['collectionFrom', 'collectionTo'],
      ['riskFrom', 'riskTo'],
      ['dueFrom', 'dueTo'],
      ['portfolioFrom', 'portfolioTo'],
      ['paymentFollowupFrom', 'paymentFollowupTo'],
      ['specialistsFrom', 'specialistsTo']
    ];

    // يأخذ التاريخين من الشاشة الحالية فقط
    for (const [fromId, toId] of datePairs) {
      const fromEl =
        active?.querySelector('#' + fromId);

      const toEl =
        active?.querySelector('#' + toId);

      const from =
        String(fromEl?.value || '').trim();

      const to =
        String(toEl?.value || '').trim();

      if (from || to) {
        const format = (value) =>
          cleanFilePart(
            value.replace(/[\/:]/g, '-'),
            'غير-محدد'
          );

        if (from && to && from !== to) {
          return format(from) + '_إلى_' + format(to);
        }

        return format(from || to);
      }
    }

    return 'بدون-تاريخ-محدد';
  }

  function buildPdfFileName(active) {
    const filterDate =
      getFilterDateText(active);

    return cleanFilePart(
      getScreenTitle(active) +
      ' - ' +
      getOfficerName(active) +
      ' - ' +
      filterDate,

      'تقرير - الكل - ' + filterDate
    ) + '.pdf';
  }

  function showPdfInPopup(popup, blob, fileName) {
    const pdfUrl =
      URL.createObjectURL(blob);

    const safeName =
      String(fileName || 'report.pdf')
        .replace(/[\\/:*?"<>|]/g, '_');

    if (!popup || popup.closed) {
      const link =
        document.createElement('a');

      link.href = pdfUrl;
      link.download = safeName;
      link.target = '_blank';

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 120000);

      return;
    }

    popup.document.open();

    popup.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeName}</title>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #f1f5f9;
    font-family: Arial, Tahoma, sans-serif;
    color: #111827;
  }

  .bar {
    position: fixed;
    z-index: 2;
    top: 0;
    right: 0;
    left: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px;
    background: #fff;
    border-bottom: 1px solid #cbd5e1;
    box-shadow: 0 2px 8px #0002;
  }

  .download {
    display: inline-block;
    background: #047857;
    color: #fff;
    text-decoration: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 700;
  }

  .open {
    display: inline-block;
    background: #1d4ed8;
    color: #fff;
    text-decoration: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 700;
  }

  .share {
    display: inline-block;
    background: #16a34a;
    color: #fff;
    border: 0;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 700;
    font-family: inherit;
    font-size: 14px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 6px;
    color: #475569;
    flex: 1;
    text-align: left;
    direction: ltr;
  }

  iframe {
    position: fixed;
    top: 62px;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: calc(100% - 62px);
    border: 0;
    background: #fff;
  }
</style>
</head>

<body>
  <div class="bar">
    <a
      class="download"
      href="${pdfUrl}"
      download="${safeName}">
      تنزيل PDF
    </a>

    <a
      class="open"
      href="${pdfUrl}"
      target="_blank"
      rel="noopener">
      فتح الملف
    </a>

    <button
      class="share"
      id="sharePdfButton"
      type="button">
      مشاركة PDF
    </button>

    <span class="name">${safeName}</span>
  </div>

  <iframe
    src="${pdfUrl}"
    title="PDF">
  </iframe>

  <script>
    (function () {
      const shareButton =
        document.getElementById('sharePdfButton');

      if (!shareButton) return;

      shareButton.addEventListener(
        'click',
        async function () {
          try {
            const response = await fetch(
              ${JSON.stringify(pdfUrl)}
            );

            const blob =
              await response.blob();

            const file = new File(
              [blob],
              ${JSON.stringify(safeName)},
              {
                type: 'application/pdf'
              }
            );

            if (
              navigator.share &&
              (
                !navigator.canShare ||
                navigator.canShare({
                  files: [file]
                })
              )
            ) {
              await navigator.share({
                files: [file],
                title: ${JSON.stringify(safeName)},
                text: 'تقرير جمعية المبادرة'
              });
            } else {
              alert(
                'المتصفح لا يدعم المشاركة المباشرة. ' +
                'اضغط تنزيل PDF ثم اختر واتساب من قائمة المشاركة.'
              );
            }

          } catch (error) {
            if (
              error &&
              error.name !== 'AbortError'
            ) {
              alert(
                'تعذرت المشاركة. ' +
                'اضغط تنزيل PDF ثم اختر واتساب.'
              );
            }
          }
        }
      );
    })();
  <\/script>
</body>
</html>`);

    popup.document.close();

    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 120000);
  }

  async function googlePrint() {
    const active =
      document.querySelector('.screen.active');

    const table =
      active?.querySelector('table');

    if (!active || !table) {
      alert(
        'لا يوجد جدول في الشاشة الحالية للطباعة.'
      );
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert(
        'مكتبة Excel غير متاحة. أعد تحميل الصفحة.'
      );
      return;
    }

    const popup =
      window.open('', '_blank');

    if (!popup) {
      alert(
        'اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة.'
      );
      return;
    }

    popup.document.write(
      '<p style="font-family:Arial;text-align:center;direction:rtl">' +
      'جارٍ تجهيز ملف PDF...' +
      '</p>'
    );

    try {
      const title = (
        active.querySelector('h1,h2,h3')?.textContent ||
        'تقرير جمعية المبادرة'
      ).trim();
      const isDueReport = active.id === 'dueInstallments';
      const dateValue = (id) => String(active.querySelector('#' + id)?.value || '').trim() || '—';
      const officer = String(active.querySelector('#dueOfficer')?.value || '').trim() || 'الكل';
      const client = String(active.querySelector('#dueClient')?.value || '').trim() || 'الكل';
      const dueCount = String(active.querySelector('#dueInstallmentsCount')?.textContent || '0').trim();
      const printedAt = new Date().toLocaleDateString('en-US');
      const headerRows = isDueReport
        ? [
            ['جمعية المبادرة — الأقساط المستحقة للأخصائيين'],
            [''],
            ['بيانات الفترة الحالية'],
            [`الأخصائي: ${officer}`, `العميل: ${client}`, `من: ${dateValue('dueFrom')}`, `إلى: ${dateValue('dueTo')}`],
            [''],
            ['عدد الأقساط المستحقة', dueCount, 'تاريخ الطباعة', printedAt],
            ['']
          ]
        : [
            [title],
            ['الفلترة الحالية: ' + filterText(active)],
            ['']
          ];

      // Build the report header first, then append the table below it. This
      // avoids overwriting the first data rows when the report is converted to PDF.
      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_dom(
        ws,
        table,
        {
          origin: { r: headerRows.length, c: 0 },
          raw: false
        }
      );
      if (isDueReport) {
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
        ];
        ws['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
      }

      const wb =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        'التقرير'
      );

      const bytes =
        new Uint8Array(
          XLSX.write(
            wb,
            {
              bookType: 'xlsx',
              type: 'array'
            }
          )
        );

      let binary = '';

      for (
        let i = 0;
        i < bytes.length;
        i += 0x8000
      ) {
        binary += String.fromCharCode(
          ...bytes.subarray(
            i,
            i + 0x8000
          )
        );
      }

      const response =
        await fetch(
          '/api/convert-google',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              fileName:
                'جمعية_المبادرة_' +
                new Date()
                  .toISOString()
                  .slice(0, 10) +
                '.xlsx',

              mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

              fileBase64:
                btoa(binary)
            })
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
          'تعذر إنشاء ملف PDF'
        );
      }

      const blob =
        base64ToBlob(
          result.pdfBase64,
          'application/pdf'
        );

      const pdfFileName =
        buildPdfFileName(active);

      showPdfInPopup(
        popup,
        blob,
        pdfFileName
      );

    } catch (error) {
      if (
        popup &&
        !popup.closed
      ) {
        popup.close();
      }

      console.error(error);

      alert(
        'تعذر إنشاء ملف PDF: ' +
        (error.message || error)
      );
    }
  }

  window.printCurrentScreen =
    googlePrint;

  window.printCollectionStandalone =
    googlePrint;

  window.printRiskReport =
    googlePrint;

  window.printClientsReport =
    googlePrint;

  window.printCollectionReport =
    googlePrint;

  window.downloadCurrentPDF =
    googlePrint;
})();
