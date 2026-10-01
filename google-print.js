(function () {
  'use strict';

  function text(value, fallback) {
    const v = String(value == null ? '' : value).trim();
    return v || (fallback || '—');
  }

  function filePart(value, fallback) {
    return text(value, fallback || 'تقرير')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getActive() {
    return document.querySelector('.screen.active');
  }

  function filterText(active) {
    const values = [];

    active.querySelectorAll('input,select').forEach((el) => {
      if (el.type === 'file' || el.type === 'hidden') return;

      const value = el.tagName === 'SELECT'
        ? text(el.selectedOptions?.[0]?.textContent, '')
        : text(el.value, '');

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

  function screenTitle(active) {
    return filePart(
      active?.querySelector('h1,h2,h3')?.textContent ||
      active?.id ||
      'تقرير',
      'تقرير'
    )
      .replace(/شاشة/g, '')
      .replace(/screen/gi, '')
      .trim();
  }

  function dateRange(active) {
    const pairs = [
      ['clientsFrom', 'clientsTo'],
      ['collectionFrom', 'collectionTo'],
      ['riskFrom', 'riskTo'],
      ['dueFrom', 'dueTo'],
      ['portfolioFrom', 'portfolioTo'],
      ['paymentFollowupFrom', 'paymentFollowupTo'],
      ['specialistsFrom', 'specialistsTo']
    ];

    for (const [fromId, toId] of pairs) {
      const from = text(
        active?.querySelector('#' + fromId)?.value,
        ''
      );

      const to = text(
        active?.querySelector('#' + toId)?.value,
        ''
      );

      if (from || to) {
        const clean = (value) =>
          filePart(
            value.replace(/[\/:]/g, '-'),
            'غير-محدد'
          );

        return from && to && from !== to
          ? clean(from) + '_إلى_' + clean(to)
          : clean(from || to);
      }
    }

    return 'بدون-تاريخ-محدد';
  }

  function showPdf(blob, name) {
    const url = URL.createObjectURL(blob);
    const popup = window.open('', '_blank');

    if (!popup) {
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      return;
    }

    popup.document.open();

    popup.document.write(`
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${name}</title>

<style>
html,
body {
  margin: 0;
  height: 100%;
  font-family: Arial, Tahoma, sans-serif;
}

body {
  background: #f1f5f9;
}

header {
  height: 54px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #ddd;
}

a {
  padding: 9px 14px;
  border-radius: 7px;
  color: #fff;
  text-decoration: none;
  font-weight: bold;
  background: #047857;
}

iframe {
  width: 100%;
  height: calc(100% - 54px);
  border: 0;
}
</style>
</head>

<body>
<header>
  <a href="${url}" download="${name}">
    تنزيل PDF
  </a>

  <a href="${url}" target="_blank">
    فتح الملف
  </a>

  <span>${name}</span>
</header>

<iframe src="${url}" title="PDF"></iframe>
</body>
</html>
`);

    popup.document.close();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 120000);
  }

  async function printReport() {
    const active = getActive();
    const table = active?.querySelector('table');

    if (!active || !table) {
      alert('لا يوجد جدول في الشاشة الحالية للطباعة.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متاحة. أعد تحميل الصفحة.');
      return;
    }

    const popup = window.open('', '_blank');

    if (!popup) {
      alert('اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة.');
      return;
    }

    popup.document.write(
      '<p style="font-family:Arial;text-align:center;direction:rtl">' +
      'جارٍ تجهيز ملف PDF...' +
      '</p>'
    );

    try {
      const due = active.id === 'dueInstallments';

      const title = due
        ? 'جمعية المبادرة — الأقساط المستحقة للأخصائيين'
        : screenTitle(active);

      const officer = text(
        active.querySelector('#dueOfficer')?.value,
        'الكل'
      );

      const client = text(
        active.querySelector('#dueClient')?.value,
        'الكل'
      );

      const count = text(
        active.querySelector('#dueInstallmentsCount')
          ?.textContent,
        '0'
      );

      const filters = due
        ? `الأخصائي: ${officer} | العميل: ${client} | من: ${
            text(
              active.querySelector('#dueFrom')?.value,
              '—'
            )
          } | إلى: ${
            text(
              active.querySelector('#dueTo')?.value,
              '—'
            )
          }`
        : filterText(active);

      /*
       * مهم:
       * في تقرير الأقساط المستحقة نرسل الجدول فقط.
       * ملف Code.gs هو الذي ينشئ العنوان والمربعات خارجه.
       */
      let ws;

      if (due) {
        ws = XLSX.utils.table_to_sheet(
          table,
          {
            raw: false
          }
        );
      } else {
        const rows = [
          [title],
          ['الفلترة الحالية: ' + filters],
          ['']
        ];

        ws = XLSX.utils.aoa_to_sheet(rows);

        XLSX.utils.sheet_add_dom(
          ws,
          table,
          {
            origin: {
              r: 3,
              c: 0
            },
            raw: false
          }
        );
      }

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        'التقرير'
      );

      const bytes = new Uint8Array(
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

      const response = await fetch(
        '/api/convert-google',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
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

            fileBase64: btoa(binary),

            reportTitle: title,

            filterText: filters,

            summaryLabel: due
              ? 'عدد الأقساط المستحقة'
              : 'عدد السجلات',

            summaryValue: due
              ? count
              : String(
                  table.querySelectorAll(
                    'tbody tr'
                  ).length || 0
                )
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ||
          'تعذر إنشاء ملف PDF'
        );
      }

      const name =
        filePart(
          title + ' - ' + dateRange(active),
          'تقرير'
        ) + '.pdf';

      showPdf(
        base64ToBlob(
          result.pdfBase64,
          'application/pdf'
        ),
        name
      );

    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }

      console.error(error);

      alert(
        'تعذر إنشاء ملف PDF: ' +
        (error.message || error)
      );
    }
  }

  window.printCurrentScreen = printReport;
  window.downloadCurrentPDF = printReport;
  window.printCollectionStandalone = printReport;
  window.printRiskReport = printReport;
  window.printClientsReport = printReport;
  window.printCollectionReport = printReport;
})();
