# 📦 EtiquetaFlow — Painel de Expedição

O **EtiquetaFlow** é uma solução centralizada para gestão e impressão em lote de etiquetas de envio para e-commerce. Ele integra múltiplos marketplaces em uma única interface intuitiva, permitindo otimizar o fluxo de expedição de mercadorias com apenas alguns cliques.

---

## 🚀 Funcionalidades

- **Painel Unificado de Impressão:** Exibe o total acumulado de etiquetas prontas para despacho.
- **Impressão em Lote (Batch Printing):** Imprima todas as etiquetas pendentes com um único clique.
- **Integração Multicanal:** Suporte nativo e sincronização com as principais plataformas do mercado:
  - **Shopee**
  - **TikTok Shop**
  - **Mercado Livre**
- **Sincronização em Tempo Real:** Monitoramento automático de etiquetas pendentes com status de sincronia (`sync`).
- **Interface Dark Mode:** Design moderno focado em produtividade e redução de fadiga visual no operador.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend / Dashboard:** Interface web responsiva e otimizada.
- **Integrações de API:** Comunicação direta com APIs de e-commerce e marketplaces.
- **Módulo de Impressão:** Processamento de documentos térmicos (ZPL, PDF, etc.).

---

## 📊 Estrutura do Painel

| Plataforma | Status de Conexão | Exemplo de Fila |
| :--- | :--- | :--- |
| **Shopee** | 🟢 Conectado | 18 etiquetas pendentes |
| **TikTok Shop** | 🟢 Conectado | 9 etiquetas pendentes |
| **Mercado Livre** | 🟢 Conectado | 15 etiquetas pendentes |
| **Total Geral** | — | **42 etiquetas** |

---

## 📦 Como Usar

1. **Conecte suas contas:** Certifique-se de que todas as integrações com os marketplaces estejam ativas.
2. **Acompanhe a Fila:** O painel recalcula automaticamente a contagem de etiquetas prontas a cada ciclo de sincronização.
3. **Execute a Impressão:** Clique no botão central **`IMPRIMIR 42 ETIQUETAS`** para enviar a fila completa para a impressora configurada.

---

## 🔧 Instalação e Execução (Para Desenvolvedores)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/etiquetaflow.git

# Acesse o diretório do projeto
cd etiquetaflow

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.