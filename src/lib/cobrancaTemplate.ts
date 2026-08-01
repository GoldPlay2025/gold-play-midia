export const DEFAULT_COBRANCA_TEMPLATE = `Olá *[Nome]*! 👋

• 𝑷𝒂𝒔𝒔𝒂𝒏𝒅𝒐 𝒑𝒂𝒓𝒂 𝒍𝒆𝒎𝒃𝒓𝒂𝒓 𝒒𝒖𝒆 𝒔𝒖𝒂 𝒎𝒆𝒏𝒔𝒂𝒍𝒊𝒅𝒂𝒅𝒆:

*GOLD MÍDIAS*
---------------------
• Vence: *[Vencimento]*
• Valor: *[Valor]*

╰⊱❖ Gold Play ❖⊱╯

*Pagamento via Pix:*
Chave Pix: *[Pix]*

• Agradecemos a parceria e ficamos à disposição!`;

export function formatCobrancaMessage(
  template: string | null | undefined,
  cliente: { nome_empresa?: string; nome?: string; valor?: number | string; vencimento?: string },
  pixKey?: string
): string {
  const tpl = (template && template.trim()) ? template : DEFAULT_COBRANCA_TEMPLATE;
  const nome = cliente.nome_empresa || cliente.nome || 'Cliente';
  
  let valorFormatado = 'R$ 0,00';
  if (cliente.valor != null && cliente.valor !== '') {
    if (typeof cliente.valor === 'number') {
      valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor);
    } else {
      const cleaned = String(cliente.valor).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      const num = parseFloat(cleaned);
      valorFormatado = !isNaN(num)
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
        : `R$ ${cliente.valor}`;
    }
  }

  let vencimentoFormatado = '-';
  if (cliente.vencimento) {
    const vStr = String(cliente.vencimento).trim();
    if (vStr.includes('/')) {
      vencimentoFormatado = vStr;
    } else {
      try {
        const parts = vStr.split('T')[0].split('-');
        if (parts.length === 3) {
          vencimentoFormatado = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          vencimentoFormatado = new Date(vStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
      } catch (e) {
        vencimentoFormatado = vStr;
      }
    }
  }

  const pix = (pixKey || '').trim() || 'Chave Pix não configurada';

  return tpl
    .replace(/\[Nome\]|\{Nome\}|\[NOME\]|\{NOME\}/gi, nome)
    .replace(/\[Valor\]|\{Valor\}|\[VALOR\]|\{VALOR\}/gi, valorFormatado)
    .replace(/\[Vencimento\]|\{Vencimento\}|\[VENCIMENTO\]|\{VENCIMENTO\}/gi, vencimentoFormatado)
    .replace(/\[Pix\]|\{Pix\}|\[PIX\]|\{PIX\}/gi, pix);
}
