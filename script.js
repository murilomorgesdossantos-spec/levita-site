// --- URL DA SUA PLANILHA (APPS SCRIPT) ---
const URL_DA_SUA_API = 'https://script.google.com/macros/s/AKfycbwGyLuktLt3wMEsco-zQWlISSk9XJprDrR-aQ6fi9oBQrADzn6djM0rCbgC1g4QECnrlg/exec';

document.addEventListener("DOMContentLoaded", () => {
    
    // --- LÓGICA DO DIÁRIO DE BORDO (INDEX.HTML) ---
    const currentContainer = document.getElementById('current-stage-container');
    
    if (currentContainer) {
        fetch(URL_DA_SUA_API)
            .then(response => response.json())
            .then(dadosBrutos => {
                
                // 1. FILTRA AS LINHAS VAZIAS (Remove linhas fantasmas do Google Sheets)
                const dados = dadosBrutos.filter(item => item.Fase && item.Fase.toString().trim() !== '');
                
                if (dados.length === 0) {
                    currentContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Nenhuma fase cadastrada na planilha ainda.</p>`;
                    return;
                }

                // 2. PEGA EXATAMENTE A ÚLTIMA LINHA PREENCHIDA
                const ultimaPosicao = dados.length - 1;
                const atual = dados[ultimaPosicao];
                
                let iframeHTML = '';
                
                // --- INÍCIO DA LÓGICA DE APRESENTAÇÃO ---
                if (atual.Apresentacao && atual.Apresentacao.trim() !== '') {
                    
                    if (atual.Apresentacao.includes('docs.google.com/presentation')) {
                        // Se for Google Slides
                        const embedLink = atual.Apresentacao.replace(/\/edit.*$/, '/embed?start=false&loop=false&delayms=3000');
                        iframeHTML = `
                            <div class="slide-placeholder" style="padding: 0; overflow: hidden; border: none;">
                                <iframe src="${embedLink}" frameborder="0" width="100%" height="100%" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                            </div>`;
                            
                    } else if (atual.Apresentacao.includes('canva.com/design')) {
                        // Se for Canva
                        const baseUrl = atual.Apresentacao.split('/view')[0];
                        const embedLink = baseUrl + '/view?embed';
                        iframeHTML = `
                            <div class="slide-placeholder" style="padding: 0; overflow: hidden; border: none;">
                                <iframe src="${embedLink}" frameborder="0" width="100%" height="100%" allowfullscreen="true" allow="fullscreen"></iframe>
                            </div>`;
                            
                    } else if (atual.Apresentacao.includes('drive.google.com')) {
                        // Se for um Arquivo do Google Drive (PDF, etc)
                        // Expressão Regular para extrair a ID única do arquivo do link bagunçado
                        const match = atual.Apresentacao.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        
                        if (match && match[1]) {
                            // Monta o link limpo de preview com a ID
                            const embedLink = `https://drive.google.com/file/d/${match[1]}/preview`;
                            iframeHTML = `
                                <div class="slide-placeholder" style="padding: 0; overflow: hidden; border: none;">
                                    <iframe src="${embedLink}" frameborder="0" width="100%" height="100%" allowfullscreen="true"></iframe>
                                </div>`;
                        } else {
                            // Fallback caso seja uma pasta do drive ou formato irreconhecível
                            iframeHTML = `
                                <div class="slide-placeholder" style="display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center;">
                                    <span style="color: var(--text-muted);">Arquivo do Drive disponível no link:</span>
                                    <a href="${atual.Apresentacao}" target="_blank" class="btn-solid" style="padding: 0.8rem 2rem;">Abrir Arquivo</a>
                                </div>`;
                        }
                            
                    } else {
                        // Link de outro site
                        iframeHTML = `
                            <div class="slide-placeholder" style="display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center;">
                                <span style="color: var(--text-muted);">Apresentação disponível no link externo:</span>
                                <a href="${atual.Apresentacao}" target="_blank" class="btn-solid" style="padding: 0.8rem 2rem;">Abrir Apresentação</a>
                            </div>`;
                    }
                } else {
                    // Célula vazia
                    iframeHTML = `<div class="slide-placeholder" style="color: var(--text-muted);">[ Nenhuma apresentação ou PDF vinculado a esta fase ]</div>`;
                }
                // --- FIM DA LÓGICA DE APRESENTAÇÃO ---

                currentContainer.innerHTML = `
                    <div class="card-header">
                        <h3>${atual.Fase}: ${atual.Titulo}</h3>
                        <span class="status-badge">Avanço Atual</span>
                    </div>
                    ${iframeHTML}
                    <p style="color: var(--text-muted);">${atual.Descricao}</p>
                `;

                // 3. A LINHA DO TEMPO (Histórico reverso: do penúltimo para o primeiro)
                const timelineContainer = document.getElementById('timeline-container');
                timelineContainer.innerHTML = ''; 

                for (let i = ultimaPosicao - 1; i >= 0; i--) {
                    const faseHistorico = dados[i];
                    
                    let linkApresentacaoHTML = '';
                    if (faseHistorico.Apresentacao && faseHistorico.Apresentacao.trim() !== '') {
                        linkApresentacaoHTML = `<br><a href="${faseHistorico.Apresentacao}" target="_blank" style="color: var(--accent-neon); text-decoration: none; font-size: 0.85rem; display: inline-block; margin-top: 0.5rem;">Ver Apresentação &rarr;</a>`;
                    }

                    timelineContainer.innerHTML += `
                        <div class="timeline-item">
                            <h3>${faseHistorico.Fase}: ${faseHistorico.Titulo}</h3>
                            <p style="color: var(--text-muted);">${faseHistorico.Descricao} ${linkApresentacaoHTML}</p>
                        </div>
                    `;
                }
            })
            .catch(erro => {
                console.error("Erro ao buscar a planilha:", erro);
                currentContainer.innerHTML = `<p style="color: #ff4d4d;">Erro ao carregar dados da planilha. Verifique a consola (F12).</p>`;
            });
    }


    // --- LÓGICA DA TELEMETRIA (VISUALIZACAO.HTML) ---
    const errorElement = document.getElementById('val-erro');
    if (errorElement) {
        function atualizarDadosPainel(dados) {
            document.getElementById('val-kp').textContent = dados.kp.toFixed(2);
            document.getElementById('val-ki').textContent = dados.ki.toFixed(2);
            document.getElementById('val-kd').textContent = dados.kd.toFixed(2);
            document.getElementById('val-setpoint').textContent = dados.setpoint.toFixed(2);
            document.getElementById('val-erro').textContent = dados.erro.toFixed(4);
        }

        setInterval(() => {
            const dadosSimulados = {
                kp: 2.50, ki: 0.10, kd: 1.05, setpoint: 10.00, erro: Math.random() * 0.5
            };
            atualizarDadosPainel(dadosSimulados);
        }, 1000);
    }
});