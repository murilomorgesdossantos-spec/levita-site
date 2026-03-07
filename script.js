// --- URL DA SUA PLANILHA (APPS SCRIPT) ---
const URL_DA_SUA_API = 'https://script.google.com/macros/s/AKfycbwGyLuktLt3wMEsco-zQWlISSk9XJprDrR-aQ6fi9oBQrADzn6djM0rCbgC1g4QECnrlg/exec';

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================================
    // --- LÓGICA DO DIÁRIO DE BORDO (INDEX.HTML) ---
    // ==========================================================
    const currentContainer = document.getElementById('current-stage-container');
    if (currentContainer) {
        fetch(URL_DA_SUA_API)
            .then(response => response.json())
            .then(dadosBrutos => {
                const dados = dadosBrutos.filter(item => item.Fase && item.Fase.toString().trim() !== '');
                if (dados.length === 0) return;

                const ultimaPosicao = dados.length - 1;
                const atual = dados[ultimaPosicao];
                
                // --- PRÉVIA INTELIGENTE (APENAS PARA O AVANÇO ATUAL) ---
                let iframeHTML = '';
                if (atual.Apresentacao && atual.Apresentacao.trim() !== '') {
                    let linkEmbed = '';
                    // Identificador inteligente de plataforma
                    if (atual.Apresentacao.includes('docs.google.com/presentation')) {
                        linkEmbed = atual.Apresentacao.replace(/\/edit.*$/, '/embed?start=false&loop=false&delayms=3000');
                    } else if (atual.Apresentacao.includes('canva.com/design')) {
                        linkEmbed = atual.Apresentacao.split('/view')[0] + '/view?embed';
                    } else if (atual.Apresentacao.includes('drive.google.com')) {
                        const match = atual.Apresentacao.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match) linkEmbed = `https://drive.google.com/file/d/${match[1]}/preview`;
                    }

                    if (linkEmbed) {
                        iframeHTML = `<div class="slide-placeholder" style="padding: 0; overflow: hidden; border: none; height: 400px; width: 100%; border-radius: 8px; margin: 1.5rem 0;"><iframe src="${linkEmbed}" frameborder="0" width="100%" height="100%" allowfullscreen="true"></iframe></div>`;
                    } else {
                        // Se for um link desconhecido, gera um botão grande
                        iframeHTML = `<div class="slide-placeholder" style="display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; height: 200px; width: 100%; border-radius: 8px; margin: 1.5rem 0; background: rgba(0,0,0,0.3);"><a href="${atual.Apresentacao}" target="_blank" class="btn-solid" style="padding: 0.8rem 2rem;">Abrir Apresentação</a></div>`;
                    }
                }

                currentContainer.innerHTML = `
                    <div class="card-header"><h3>${atual.Fase}: ${atual.Titulo}</h3><span class="status-badge">Avanço Atual</span></div>
                    ${iframeHTML}
                    <p style="color: var(--text-muted); line-height: 1.6;">${atual.Descricao}</p>
                `;

                // --- APENAS BOTÃO "VER MATERIAL" PARA O HISTÓRICO ---
                const timelineContainer = document.getElementById('timeline-container');
                timelineContainer.innerHTML = ''; 

                for (let i = ultimaPosicao - 1; i >= 0; i--) {
                    const faseHistorico = dados[i];
                    
                    let botaoHist = '';
                    if (faseHistorico.Apresentacao && faseHistorico.Apresentacao.trim() !== '') {
                        botaoHist = `<div style="margin-top: 1rem;"><a href="${faseHistorico.Apresentacao}" target="_blank" class="btn-neon" style="font-size: 0.8rem; padding: 0.4rem 1.2rem;">Ver material</a></div>`;
                    }
                    
                    timelineContainer.innerHTML += `
                        <div class="timeline-item">
                            <h3>${faseHistorico.Fase}: ${faseHistorico.Titulo}</h3>
                            <p style="color: var(--text-muted); line-height: 1.5;">${faseHistorico.Descricao}</p>
                            ${botaoHist}
                        </div>
                    `;
                }
            }).catch(erro => console.error("Erro:", erro));
    }

    // ==========================================================
    // --- MOTOR FÍSICO PID DIDÁTICO E GRÁFICO (VISUALIZACAO) ---
    // ==========================================================
    const canvas = document.getElementById('pidChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        
        // Elementos de Controle e Inputs
        const btnPlay = document.getElementById('btn-play');
        const btnReset = document.getElementById('btn-reset');
        
        const inputs = {
            kp: document.getElementById('input-kp'),
            ki: document.getElementById('input-ki'),
            kd: document.getElementById('input-kd'),
            sp: document.getElementById('input-sp'),
            initPv: document.getElementById('input-init-pv')
        };
        const displayErro = document.getElementById('val-erro');

        const imaMovel = document.getElementById('ima-movel');
        const linhaSetpoint = document.getElementById('linha-setpoint');

        // Função para mapear o valor (0 a 20) para porcentagem de altura no CSS (10% a 78%)
        function mapearParaTela(valor) {
            const minPcnt = 10;  // Chão
            const maxPcnt = 78;  // Colado no eletroímã
            const porcentagem = minPcnt + (valor / 20) * (maxPcnt - minPcnt);
            return Math.max(minPcnt, Math.min(maxPcnt, porcentagem));
        }

        // Estado da Simulação
        let isRunning = false;
        
        // Variáveis do Motor Físico
        let pv = parseFloat(inputs.initPv.value); // Posição atual
        let velocity = 0;   
        let integral = 0;   
        let prevError = 0;  
        
        // Constantes da Física Didática (Modelo Linear de 2ª Ordem)
        const dt = 0.05;    // Tempo do passo
        const massa = 1.0;  // Massa
        const gravidade = 25.0; // Gravidade puxando pra baixo
        const arrasto = 1.2;    // Atrito do ar (amortecimento natural)

        // Arrays do Gráfico
        const maxPoints = 150;
        let timeData = new Array(maxPoints).fill(0).map((_, i) => i);
        let pvData = new Array(maxPoints).fill(pv);
        let spData = new Array(maxPoints).fill(parseFloat(inputs.sp.value));

        // Inicializa o Chart.js
        const pidChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData,
                datasets: [
                    {
                        label: 'Posição (PV)',
                        data: pvData,
                        borderColor: '#d000ff',
                        backgroundColor: 'rgba(208, 0, 255, 0.1)',
                        borderWidth: 2, pointRadius: 0, fill: true, tension: 0.2
                    },
                    {
                        label: 'SetPoint (SP)',
                        data: spData,
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0, fill: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: {
                    x: { display: false },
                    y: { min: 0, max: 20, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });

        // Controles de Botões
        btnPlay.addEventListener('click', () => {
            isRunning = !isRunning;
            if (isRunning) {
                btnPlay.textContent = "⏸ Pausar Simulação";
                btnPlay.style.background = "linear-gradient(90deg, #ff0055, #ff0000)";
                inputs.initPv.disabled = true; 
            } else {
                btnPlay.textContent = "▶ Continuar Simulação";
                btnPlay.style.background = "linear-gradient(90deg, var(--accent-solid), var(--accent-neon))";
            }
        });

        btnReset.addEventListener('click', () => {
            isRunning = false;
            btnPlay.textContent = "▶ Iniciar Simulação";
            btnPlay.style.background = "linear-gradient(90deg, var(--accent-solid), var(--accent-neon))";
            inputs.initPv.disabled = false;
            
            // Reseta a física
            pv = parseFloat(inputs.initPv.value);
            velocity = 0;
            integral = 0;
            prevError = 0;
            
            // Reseta o Gráfico
            const sp = parseFloat(inputs.sp.value);
            pvData.fill(pv);
            spData.fill(sp);
            pidChart.update();
            
            // Reseta Visual
            displayErro.textContent = "0.000";
            if (imaMovel && linhaSetpoint) {
                imaMovel.style.bottom = `${mapearParaTela(pv)}%`;
                linhaSetpoint.style.bottom = `${mapearParaTela(sp)}%`;
            }
        });

        // Loop Principal (30ms)
        setInterval(() => {
            const setpoint = parseFloat(inputs.sp.value);
            
            // Atualiza linha do Setpoint e ímã dinamicamente mesmo pausado
            if (!isRunning) {
                pv = parseFloat(inputs.initPv.value);
                if (imaMovel && linhaSetpoint) {
                    imaMovel.style.bottom = `${mapearParaTela(pv)}%`;
                    linhaSetpoint.style.bottom = `${mapearParaTela(setpoint)}%`;
                }
                const erro = setpoint - pv;
                displayErro.textContent = erro.toFixed(3);
                return; // Não roda a física se estiver pausado
            }

            // --- Lógica Física Rodando ---
            const kp = parseFloat(inputs.kp.value);
            const ki = parseFloat(inputs.ki.value);
            const kd = parseFloat(inputs.kd.value);

            // 1. Calcula o Erro
            const erro = setpoint - pv;
            displayErro.textContent = erro.toFixed(3);

            // 2. Ação Integral (com anti-windup)
            integral += erro * dt;
            if (integral > 100) integral = 100; 
            if (integral < -100) integral = -100;

            // 3. Ação Derivativa
            const derivativo = (erro - prevError) / dt;
            prevError = erro;

            // 4. Sinal de Controle PID (Força Magnética gerada pela bobina)
            let forcaMagnetica = (kp * erro) + (ki * integral) + (kd * derivativo);
            
            // O Eletroímã só puxa para cima, não empurra para baixo.
            if (forcaMagnetica < 0) forcaMagnetica = 0; 

            // 5. Aplica a Segunda Lei de Newton (F = m * a)
            const forcaLiquida = forcaMagnetica - gravidade - (velocity * arrasto);
            const aceleracao = forcaLiquida / massa;
            
            velocity += aceleracao * dt;
            pv += velocity * dt;

            // Limites físicos (Bateu na base ou colou no eletroímã)
            if (pv < 0) { pv = 0; velocity = 0; }
            if (pv > 18) { pv = 18; velocity = -velocity * 0.3; } // Quique ao bater no topo

            // 6. Atualiza o Gráfico
            pvData.shift(); pvData.push(pv);
            spData.shift(); spData.push(setpoint);
            pidChart.update();

            // 7. Atualiza o Visual do Ímã
            if (imaMovel && linhaSetpoint) {
                imaMovel.style.bottom = `${mapearParaTela(pv)}%`;
                linhaSetpoint.style.bottom = `${mapearParaTela(setpoint)}%`; 
            }

        }, 30);
    }
});