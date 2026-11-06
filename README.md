# EtiquetaFlow

Painel web para automatizar a impressão de etiquetas de envio do **Mercado Livre**, da **Shopee** e do **TikTok Shop** a partir de um só lugar.

O painel mostra quantas etiquetas estão pendentes em cada canal, imprime todas de uma vez em uma impressora térmica e permite agendar impressões automáticas, por exemplo toda segunda-feira às 07:00.

> **Projeto de demonstração.** Todos os dados são simulados: nenhuma API de marketplace e nenhuma impressora real são acessadas. O objetivo é mostrar a interface e o fluxo completo de uso.

![Painel principal do EtiquetaFlow](docs/painel.png)

## Funcionalidades

- **Etiquetas pendentes:** total em destaque e quantidade por canal, com uma etiqueta térmica ilustrada que mostra o lote atual.
- **Impressão em três fases:** conexão às APIs, consolidação das etiquetas em PDF único ou spooler térmico e envio para a impressora (simulando o QZ Tray). O progresso aparece em tela cheia e termina com um selo de confirmação.
- **Cancelamento:** a impressão pode ser interrompida a qualquer momento, e as etiquetas continuam pendentes.
- **Integrações:** status de conexão, latência da API e última sincronização de cada marketplace, além de um botão para sincronizar novos pedidos.
- **Agendamento:** liga e desliga a automação, escolhe os dias da semana e o horário, mostra uma contagem regressiva até a próxima impressão e dispara a impressão sozinho no horário definido.
- **Histórico:** lista das últimas impressões com data, canal, quantidade e status.
- **Dados salvos no navegador:** pendências, agendamento e histórico ficam guardados no `localStorage` e voltam ao recarregar a página.
- **Responsivo e acessível:** funciona de 320 px até telas grandes, permite navegação por teclado e respeita a opção do sistema de reduzir animações.

| Agendamento | Impressão concluída |
| --- | --- |
| ![Painel de agendamento com contagem regressiva](docs/agendamento.jpg) | ![Tela de impressão concluída com selo dourado](docs/impressao.png) |

<p align="center">
  <img src="docs/celular.png" alt="EtiquetaFlow no celular" width="280" />
</p>

## Tecnologias

- HTML5 e CSS3
- JavaScript puro (sem frameworks)
- [Tailwind CSS](https://tailwindcss.com) via CDN, com o plugin `forms`
- Fontes [Jost](https://fonts.google.com/specimen/Jost) e [Courier Prime](https://fonts.google.com/specimen/Courier+Prime), do Google Fonts

O projeto não precisa de instalação, build nem servidor.

## Como executar

1. Clone o repositório:

   ```bash
   git clone https://github.com/matheusaribeirodev/etiquetaflow.git
   cd etiquetaflow
   ```

2. Abra o arquivo `index.html` no navegador.

É preciso estar conectado à internet, porque o Tailwind e as fontes são carregados por CDN.

Para publicar no **GitHub Pages**, vá em *Settings → Pages*, escolha a branch `main` e a pasta raiz (`/`). O painel fica disponível em `https://matheusaribeirodev.github.io/etiquetaflow/`.

## Estrutura do projeto

```
etiquetaflow/
├── index.html              Estrutura da página
├── css/
│   └── style.css           Estilos próprios: etiqueta, animações, painel e tela de impressão
├── js/
│   ├── tailwind.config.js  Cores e fontes do Tailwind
│   └── app.js              Estado, impressão simulada, agendamento e animações de scroll
└── docs/                   Capturas de tela usadas neste README
```

## Como funciona a simulação

Toda a lógica fica em `js/app.js`:

- `startPrint()` executa as três fases da impressão com atrasos simulados e pode ser cancelada.
- `finishPrint()` zera as pendências, registra o lote no histórico e salva o estado.
- `computeNextRun()` calcula a próxima data de execução a partir dos dias e do horário escolhidos.
- `tick()` roda a cada segundo, atualiza a contagem regressiva e dispara a impressão agendada.
- `syncOrders()` simula a chegada de novos pedidos nos três canais.

Para restaurar os dados iniciais, use o link **Restaurar dados de demonstração** no rodapé da página.

## Limitações

- As integrações com os marketplaces e com a impressora são simuladas.
- O agendamento só funciona enquanto a aba do navegador estiver aberta.
- Os dados ficam salvos apenas no navegador de quem usa a página.

## Próximos passos

Para transformar a demonstração em um sistema real, cada fase simulada precisaria ser trocada por uma integração de verdade:

- um back-end que autentique e busque as etiquetas nas APIs do Mercado Livre, da Shopee e do TikTok Shop;
- um agente local, como o [QZ Tray](https://qz.io), para enviar as etiquetas direto para a impressora térmica;
- um agendador no servidor, para que as impressões automáticas rodem mesmo com o navegador fechado.

## Autor

Desenvolvido por **Matheus Augusto Ribeiro**, estudante de Análise e Desenvolvimento de Sistemas no SENAI.

[github.com/matheusaribeirodev](https://github.com/matheusaribeirodev)
