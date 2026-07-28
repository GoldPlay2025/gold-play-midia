async function run() {
    const smsResp = await fetch("https://sms.gtisms.com/api/v3/sms/send", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer BADTOKEN`
      },
      body: JSON.stringify({recipient: '5511999999999', message: 'test', type: 'plain'})
    });
    console.log(smsResp.ok);
    const text = await smsResp.text();
    console.log(text);
}
run();
