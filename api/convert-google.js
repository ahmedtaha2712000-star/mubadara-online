export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const scriptToken = process.env.GOOGLE_SCRIPT_TOKEN;

  if (!scriptUrl || !scriptToken) {
    return res.status(500).json({
      ok: false,
      error: 'Google PDF service is not configured'
    });
  }

  try {
    const { fileBase64, fileName, mimeType } = req.body || {};

    if (!fileBase64 || !fileName) {
      return res.status(400).json({
        ok: false,
        error: 'fileBase64 and fileName are required'
      });
    }

    const requestBody = JSON.stringify({
      token: scriptToken,
      fileBase64,
      fileName,
      mimeType:
        mimeType ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: requestBody,
      redirect: 'manual'
    };

    let upstream = await fetch(scriptUrl, requestOptions);

    const redirectCodes = new Set([
      301,
      302,
      303,
      307,
      308
    ]);

    const location = upstream.headers.get('location');

    if (redirectCodes.has(upstream.status) && location) {
      upstream = await fetch(location, requestOptions);
    }

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
      error: error?.message || 'Unexpected conversion error'
    });
  }
}
