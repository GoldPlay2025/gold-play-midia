const sanitizeSms = (text) => {
    let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
    sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
    return sanitized;
};
console.log(sanitizeSms("Gold Mídias: Mensalidade de R$\xA0120,00 vence amanhã 🚀"));
