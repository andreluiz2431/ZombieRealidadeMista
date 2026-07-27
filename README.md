# 🧟 Zombieland MR — Apocalipse Zumbi em Primeira Pessoa (MR / FPS / AR)

**Zombieland MR** (Mixed Reality) é uma experiência de sobrevivência zumbi 3D em Primeira Pessoa (FPS) desenvolvida para navegadores web, celulares e adaptável para aplicativos Android. O jogo combina **Visão Computacional (IA Hand Tracking)**, **Navegação por Sensores/GPS**, **Suporte a Controle Xbox One**, **Controles de Computador (WASD + Mouse Look)** e renderização em **Realidade Virtual (Google Cardboard VR)**.

---

## 🌟 Modos de Jogo & Plataformas de Controle

O jogo oferece **3 Modos de Controle Principais** na tela inicial, adaptando a interface e os sensores para cada experiência:

### 📱 1. Modo Celular (Sensores & Realidade Aumentada)
Projetado para smartphones com acelerômetro, giroscópio e câmera:
- **Giroscópio 360°**: Gire o smartphone para olhar em todas as direções (suporte automático a telas viradas na horizontal/Landscape com compensação de offset).
- **Acelerômetro & Passômetro**: Seus passos físicos movem o personagem no mundo 3D.
- **Geolocalização (GPS)**: Posição real via mapa com casas de segurança (Safe Houses) e radares.
- **Joystick Virtual**: Botão direcional analógico na tela para caminhar pelo polegar.
- **Google Cardboard VR**: Renderização Estereoscópica Dual-Eye (`THREE.StereoCamera`) para óculos de Realidade Virtual.

### 💻 2. Modo Computador (PC — WASD + Mouse Look)
Otimizado para jogar no navegador do PC com teclado e mouse:
- **Navegação WASD Sincronizada**: As teclas `W`, `A`, `S`, `D` movimentam o personagem sempre alinhadas com a direção da câmera para onde o jogador está olhando.
- **Visão do Mouse (Pointer Lock)**: Movimente o mouse livremente para direcionar a visão 360°.
- **Ataques Rápidos pelos Clicks**:
  - **Botão Esquerdo do Mouse**: Soco de Mão Esquerda.
  - **Botão Direito do Mouse**: Tacada de Bastão de Beisebol com Mão Direita.
- **Menu de Pause com a Tecla ESC**: Pressionar `ESC` durante a partida pausa o jogo instantaneamente, liberando o ponteiro do mouse e exibindo o modal com opções para **Retomar Jogo** ou **Ir para Tela Inicial (Sair)**.
- *Nota*: Desativa automaticamente GPS, Acelerômetro, Giroscópio e Joystick da tela.

### 🎮 3. Modo Controle Xbox One (PC & Celular)
Suporte nativo a controles gamepad (Bluetooth ou USB) no PC e no Smartphone:
- **Analógico Esquerdo**: Caminhada fluida direcionada em relação à visão.
- **Analógico Direito**: Rotação suave da câmera 360°.
- **Botões e Gatilhos (LT / RT / Bumpers)**: Golpes de bastão e socos.
- **Botão Start (Menu)**: Pausa o jogo instantaneamente.
- **Sub-opções de Personalização**:
  1. *Método de Ataque*: Escolha entre usar os **Botões do Controle** ou **Gestos de Mão pela Câmera (IA MediaPipe)**.
  2. *Sensor de Câmera/Giroscópio*: Escolha entre **Somente Controle** (sem sensores) ou **Controle + Giroscópio (AR/VR)** para mover a cabeça fisicamente com o celular enquanto anda pelos analógicos.

---

## 🎯 Mecânicas Principais & Regras de Jogo

- **Raio de Surgimento dos Zumbis**: Os zumbis surgem em ondas (*waves*) a uma distância ajustada entre **17 e 23 metros** do jogador, garantindo tempo de reação estratégico.
- **Comportamento & IA dos Zumbis**:
  - **Perseguição (`chasing`)**: Zumbis correm em direção ao jogador ao detectá-lo.
  - **Ataque (`attacking`)**: Ao se aproximarem a menos de 2.2 metros, aplicam dano na vida do jogador.
  - **Escape (`idle`)**: Se o jogador se afastar mais de 16.25 metros, o zumbi perde o rastro e volta a vagar.
- **Casas de Segurança (Safe Houses)**: Áreas demarcadas em verde no mapa e no Radar HUD que recuperam a saúde do jogador gradualmente ao entrar nelas.
- **Radar HUD**: Indicador circular mostrando a posição relativa de zumbis (pontos vermelhos), abrigos (pontos verdes) e outros sobreviventes.
- **Salas Multijogador em Tempo Real**: Digite um código de sala idêntico ao de seus amigos para ver seus avatares 3D e sobreviverem juntos.

---

## 🛠️ Arquitetura do Projeto & Onboarding para Desenvolvedores

### Estrutura dos Arquivos Principais

```text
├── App.tsx                    # Componente principal: gerenciamento de estado, menus, loop de inputs (WASD, Mouse, Gamepad, Sensores), pause e HUD
├── types.ts                  # Definições de tipos TypeScript (ControlMode, GameStatus, PlayerPos, etc.)
├── constants.ts              # Constantes globais do jogo
├── components/
│   ├── GameScene.tsx         # Cena 3D principal (Three.js / React Three Fiber)
│   ├── Hands3D.tsx           # Modelos 3D das mãos do jogador (Bastão e Soco) e animações de ataque
│   ├── Zombie3D.tsx          # Renderização e animação procedural dos zumbis
│   ├── Environment3D.tsx     # Terreno, Iluminação, Céu e Nevoeiro
│   ├── House3D.tsx           # Abrigos de segurança (Safe Houses)
│   ├── RadarHUD.tsx          # Minimapa / Radar de sobrevivência 2D
│   ├── VirtualJoystick.tsx   # Controles na tela touch para celular
│   └── WebcamPreview.tsx     # Feed de câmera com overlay de landmarks do MediaPipe
├── hooks/
│   ├── useGyroscope.ts       # Hook de calibração e rotação da câmera por Giroscópio/Mouse
│   ├── useAccelerometerMovement.ts # Detecção de passos via sensores do dispositivo
│   ├── useMediaPipe.ts       # Rastreamento de mãos por Visão Computacional
│   └── useFullscreen.ts      # Controle de tela cheia
└── metadata.json             # Metadados e permissões da aplicação Zombieland MR
```

---

## 🚀 Como Executar e Compilar o Projeto

### Pré-requisitos
- Node.js (versão 18+)
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
   A aplicação roda na porta `3000` (`http://localhost:3000`).

3. **Compilar para Produção**:
   ```bash
   npm run build
   ```

> **Dica para Testes com Dispositivos Móveis**: Para usar os recursos de Câmera e Giroscópio no celular, acesse a URL gerada pelo ambiente ou via protocolo HTTPS.

---

## 📄 Licença

Projeto desenvolvido como uma demonstração tecnológica avançada de jogos 3D Web, Realidade Aumentada e Rastreamento de Mãos em Tempo Real.

