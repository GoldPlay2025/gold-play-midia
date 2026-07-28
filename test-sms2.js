async function run() {
    const httpResp = await fetch("https://sms.gtisms.com/api/http/sms/send?api_token=BADTOKEN&recipient=5511999999999&message=test");
    console.log(httpResp.ok);
    const text = await httpResp.text();
    console.log(text);
}
run();
