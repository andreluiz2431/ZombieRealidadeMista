# 🧟 Zombieland GPS — Apocalipse Zumbi em Primeira Pessoa

**Zombieland GPS** é uma experiência imersiva de sobrevivência zumbi em 3D em Primeira Pessoa (FPS) desenvolvida para navegadores web e dispositivos móveis. A aplicação combina **rastreamento de mãos por Visão Computacional (IA)**, **posicionamento em tempo real por GPS**, **orientação 360° por Giroscópio** e suporte a **óculos de Realidade Virtual (Google Cardboard VR)**.

---

## 🌟 Principais Recursos

### 👓 1. Modo Google Cardboard VR (Estereoscópico)
- **Renderização Estereoscópica Dual Eye**: Separação precisa para o olho esquerdo e direito via `THREE.StereoCamera`.
- **Reticulado e Guia Central**: Interface adaptada para óculos VR de papelão ou plástico.
- **Alternância Instantânea**: Ativação com 1 clique tanto no menu principal quanto durante a partida.

### 📱 2. Giroscópio 360° com Suporte a Modo Paisagem (Landscape)
- **Acompanhamento de Orientação Nativo**: Gire o smartphone para olhar em todas as direções (360° Yaw, Pitch e Roll).
- **Ajuste Automático de Tela (Landscape/Portrait)**: Rotação compensada dinamicamente quando o celular é virado na horizontal.
- **Calibração Rápida**: Botão de re-centralização em 1 toque para ajustar o ponto de vista central instantaneamente.

### 📷 3. Seleção de Câmera (Frontal / Traseira)
- **Aalternância Dinâmica**: Escolha entre a câmera frontal (selfie) ou traseira (ambiente à sua frente).
- **Rastreamento por Visão Computacional**: Processamento de gestos com MediaPipe HandLandmarker.

### 🥊 4. Controles por Gestos de Mão e Combate Real
- **Mão Direita (Bastão de Beisebol)**: Balance a mão para desferir tacadas físicas e abater zumbis.
- **Mão Esquerda (Soco em Combate)**: Projete o punho em direção à tela para socar os zumbis no alcance próximo.
- **Fallback para Mouse / Touch / Teclado**: Suporte para arrastar na tela no PC/Mobile e movimentação pelas teclas WASD/Setas.

### 📍 5. Movimentação por GPS Real & Radar HUD
- **Deslocamento no Mundo**: Seus passos no mundo real movem seu personagem no mapa 3D.
- **Radar de Sobrevivência**: Exibe a posição relativa de zumbis próximos, abrigos seguros e outros sobreviventes no HUD.
- **Casas de Segurança (Safe Houses)**: Áreas demarcadas no mapa para recuperar vida e se proteger de hordas.

### 🌐 6. Modo Multijogador em Tempo Real
- **Salas de Sobrevivência**: Conecte-se com amigos digitando o mesmo código de sala.
- **Sincronização de Jogadores**: Visualize o avatar e posição de outros sobreviventes no mapa 3D.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend Core**: React 18, TypeScript, Vite, Tailwind CSS.
- **Renderização 3D**: Three.js, `@react-three/fiber`, `@react-three/drei`.
- **Visão Computacional & IA**: `@mediapipe/tasks-vision` (HandLandmarker).
- **Sensores de Dispositivo**: Web Geolocation API, DeviceOrientation API, Screen Orientation API.
- **Ícones e UI**: Lucide React.

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)
- Gerenciador de pacotes `npm` ou `bun`

### Passos
1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Iniciar o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

3. **Acessar a aplicação**:
   Abra o navegador e acesse `http://localhost:3000`.

> **Nota**: Para utilizar a câmera e o giroscópio no smartphone, certifique-se de acessar via HTTPS ou no ambiente local configurado.

---

## 🎮 Como Jogar

1. **Configuração Inicial**:
   - Escolha o nome do sobrevivente e o código da sala multijogador.
   - Selecione a **Câmera Principal** (Frontal ou Traseira).
   - Ative ou desative o recurso **Google Cardboard VR** se for utilizar óculos de realidade virtual.
   - Ative ou desative o sensor de **Giroscópio** e o **Modo Tela Cheia**.
2. **Inicie o Jogo**:
   - Permita o acesso à **Localização (GPS)** e à **Câmera**.
3. **Sobreviva à Horda**:
   - Mova o celular para olhar ao redor.
   - Movimente a mão direita para golpear com o bastão ou a esquerda para socar.
   - Encontre abrigos verdes no radar para curar a vida perdida.

---

## 📄 Licença

Este projeto foi desenvolvido como uma demonstração tecnológica interativa de jogos 3D web em tempo real.
