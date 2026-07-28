const fs = require('fs');
let code = fs.readFileSync('src/components/ClientesList.tsx', 'utf8');

const target = `      if (error) throw error;
      
      setRenewingId(null);`;

const replacement = `      if (error) throw error;
      
      if (cliente.email) {
        // Enviar e-mail de confirmação de pagamento
        const newVencimentoDate = new Date(newVencimento);
        newVencimentoDate.setMinutes(newVencimentoDate.getMinutes() + newVencimentoDate.getTimezoneOffset());
        const dateStr = newVencimentoDate.toLocaleDateString('pt-BR');

        fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cliente.email,
            subject: 'Confirmação de Pagamento - GOLD PLAY Digital Signage',
            html: \`
              <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f0f11; color: #fff; borderRadius: 12px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981; margin-bottom: 10px;">Pagamento Confirmado!</h2>
                <p style="color: #cbd5e1; font-size: 16px;">Olá <strong>\${cliente.nome_empresa}</strong>,</p>
                <p style="color: #cbd5e1; font-size: 14px;">Confirmamos o recebimento do seu pagamento. Sua assinatura foi renovada com sucesso e seu novo vencimento é <strong>\${dateStr}</strong>.</p>
                <p style="color: #cbd5e1; font-size: 14px;">Agradecemos a confiança em nossos serviços!</p>
                <hr style="border-color: #334155; margin: 20px 0;" />
                <p style="font-size: 12px; color: #64748b;">GOLD PLAY Digital Signage<br/>Mensagem automática, não é necessário responder.</p>
              </div>
            \`
          })
        }).catch(err => console.error('Erro ao enviar e-mail de confirmação:', err));
      }

      setRenewingId(null);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ClientesList.tsx', code);
