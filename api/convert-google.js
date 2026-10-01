export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const clean = (value) => String(value || '')
    .trim()
    .replace(/^[\s'"`]+|[\s'"`]+$/g, '');

  const scriptUrl = clean(
    process.env.GOOGLE_SCRIPT_URL
  );

  const scriptToken = clean(
    process.env.GOOGLE_SCRIPT_TOKEN
  );

  if (!scriptUrl || !scriptToken) {
    return res.status(500).json({
      ok: false,
      error: 'Google PDF service is not configured'
    });
  }

  if (!/^https:\/\//i.test(scriptUrl)) {
    return res.status(500).json({
      ok: false,
      error: 'GOOGLE_SCRIPT_URL must start with https://'
    });
  }

  try {
    const {
      fileBase64,
      fileName,
      mimeType,
      reportTitle,
      filterText,
      summaryLabel,
      summaryValue,
      logoBase64,
      logoMimeType
    } = req.body || {};

    if (!fileBase64 || !fileName) {
      return res.status(400).json({
        ok: false,
        error: 'fileBase64 and fileName are required'
      });
    }

    const body = JSON.stringify({
      token: scriptToken,
      fileBase64,
      fileName,
      mimeType:
        mimeType ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      reportTitle: String(reportTitle || '').slice(0, 200),
      filterText: String(filterText || '').slice(0, 3000),
      summaryLabel: String(summaryLabel || '').slice(0, 120),
      summaryValue: String(summaryValue || '').slice(0, 120),
      logoBase64: String(logoBase64 || ''),
      logoMimeType: String(logoMimeType || 'image/png')
    });

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body,
      redirect: 'follow'
    });

    const text = await upstream.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (_) {
      data = {
        ok: false,
        error: 'Invalid response from Google Apps Script'
      };
    }

    if (!upstream.ok || !data.ok) {
      return res.status(502).json({
        ok: false,
        error: data.error || 'Google PDF conversion failed'
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error:
        error?.cause?.message ||
        error?.message ||
        'Unexpected conversion error'
    });
  }
}
