const msg = "Gold Midias: Mensalidade de R$\xA0120,00 vence dia 24/07/2026. Pix para pgto: (44) 99169-7336. Ignore se ja pago.";
async function run() {
    const httpResp = await fetch("https://sms.gtisms.com/api/v3/sms/send", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer 389|B6WZ6JbjbLypgxlF3DuJPBgJBYaP1SUfFUT0EdSPf52456a5`
      },
      body: JSON.stringify({recipient: '5511999999999', message: msg, type: 'plain'})
    });
    const text = await httpResp.text();
    console.log(text);
}
run();
