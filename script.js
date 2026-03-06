// AVISO PARA O SEU COLEGA: Inserir a chave de API aqui
const GEMINI_API_KEY = 'AIzaSyC8Fy99fufY26DjqRbTpkLuB_U2IldgZzs'; 

const USER_QUERY = `
    # INSTRUÇÃO MESTRA
    Atue como uma API de análise de acessibilidade digital, especializada em WCAG 2.2. Sua única fonte de informação é a imagem de uma interface web fornecida. Sua tarefa é retornar um relatório de acessibilidade em um único objeto JSON válido, seguindo as regras e a estrutura abaixo com máxima precisão.

    # REGRAS CRÍTICAS
    1.  **ANÁLISE ESTRITAMENTE VISUAL:** Sua avaliação deve ser baseada **100% e exclusivamente** nos elementos visuais presentes na imagem. É **PROIBIDO** fazer suposições sobre o código-fonte (HTML, CSS, ARIA), performance ou comportamento de leitores de tela.
    2.  **PRECISÃO ACIMA DE QUANTIDADE:** Seu objetivo principal é a precisão. Identifique apenas violações que são claramente visíveis ou altamente prováveis a partir do design. Se o design parecer bom e não houver violações claras, Não invente problemas.
    3.  **VIOLAÇÕES PROVÁVEIS:** Se uma violação é uma inferência lógica mas não 100% visível (ex: um ícone de busca sem texto visível *provavelmente* precisa de um texto alternativo), identifique-a, mas marque-a no JSON.
    4.  **SAÍDA JSON PURA E EXCLUSIVA:** A resposta deve ser **APENAS** o código JSON. Sua saída deve começar DIRETAMENTE com o caractere '{' e terminar DIRETAMENTE com o caractere '}'. Nenhum outro caractere, texto, explicação, ou formatação de markdown (como \`\`\`) é permitido antes do JSON de abertura ou depois do JSON de fechamento.

    # ESTRUTURA E EXEMPLO DE SAÍDA JSON
    Sua resposta DEVE seguir esta estrutura. 

    {
    "analiseGeral": {
        "nivelConformidadeEstimado": "<A, AA ou AAA>",
        "justificativa": "<Justificativa curta para o nível estimado>",
        "comentariosGerais": "<Um resumo em texto livre. Se não houver violações, USE ESTE CAMPO para elogiar as boas práticas observadas, como bom contraste, tipografia legível, etc.>"
    },
    "violacoesIdentificadas": [
        {
        "criterioSucesso": {
            "id": "<String, ex: '1.4.3'>",
            "nome": "<String, ex: 'Contraste (Mínimo)'>"
        },
        "nivelConformidadeCriterio": "<A, AA ou AAA>",
        "descricaoProblema": "<String descrevendo a violação>",
        "sugestaoCorrecao": "<String com a sugestão de correção>",
        "eProvavel": "<Boolean: 'true' se for uma inferência, 'false' se for diretamente visível>"
        }
    ]
    }
`;

document.getElementById("siteForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const url = document.getElementById("url").value;
    const resultadoContainer = document.getElementById("resultado-container");
    const analysisTextSection = document.getElementById("analysis-text-section");
    const screenshotSection = document.getElementById("screenshot-section");
    
    // Textos profissionais e sem emojis
    resultadoContainer.classList.add("ativo");
    analysisTextSection.innerHTML = `<p>Acessando <strong>${url}</strong> para capturar a página... Isso pode demorar alguns segundos.</p>`;
    screenshotSection.innerHTML = ''; 

    try {
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
        const mlResponse = await fetch(microlinkUrl);
        const mlData = await mlResponse.json();

        if (mlData.status !== 'success' || !mlData.data.screenshot) {
            throw new Error("Não foi possível capturar a tela desse site. Verifique se a URL está correta e tente novamente.");
        }

        const imageUrl = mlData.data.screenshot.url;
        analysisTextSection.innerHTML = `<p>Captura concluída. Iniciando a análise de acessibilidade da interface...</p>`;

        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();

        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64Data = reader.result.split(',')[1];
            const mimeType = 'image/png'; 

            try {
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: USER_QUERY },
                                { inlineData: { mimeType: mimeType, data: base64Data } }
                            ]
                        }]
                    })
                });

                const data = await apiResponse.json();

                if (apiResponse.ok) {
                    const analysisText = data.candidates[0].content.parts[0].text;
                    const reportData = JSON.parse(analysisText);

                    analysisTextSection.innerHTML = createReportHTML(reportData);

                    screenshotSection.innerHTML = `
                        <h3>Screenshot da Página:</h3>
                        <img src="${imageUrl}" alt="Screenshot de ${url}">
                    `;
                } else {
                    throw new Error(data.error?.message || 'Erro na requisição da API de análise.');
                }
            } catch (err) {
                console.error("Erro na análise:", err);
                analysisTextSection.innerHTML = `<p style="color:red; font-weight:bold;">Ocorreu um erro durante a análise: ${err.message}</p>`;
            }
        };
        
        reader.readAsDataURL(imageBlob);

    } catch (err) {
        console.error("Erro na captura:", err);
        analysisTextSection.innerHTML = `<p style="color:red; font-weight:bold;">Ocorreu um erro: ${err.message}</p>`;
    }
});

function createReportHTML(reportData) {
    const { analiseGeral, violacoesIdentificadas } = reportData;

    let html = `
        <div class="geral-info">
            <h3>Análise Geral</h3>
            <p><strong>Nível Estimado:</strong> ${analiseGeral.nivelConformidadeEstimado}</p>
            <p><strong>Justificativa:</strong> ${analiseGeral.justificativa}</p>
            <p><strong>Comentários:</strong> ${analiseGeral.comentariosGerais}</p>
        </div>
    `;

    if (violacoesIdentificadas && violacoesIdentificadas.length > 0) {
        html += `<h3>Violações Identificadas (${violacoesIdentificadas.length})</h3>`;
        
        violacoesIdentificadas.forEach(violacao => {
            html += `
                <div class="violation-card">
                    <h4>${violacao.criterioSucesso.nome} (Critério ${violacao.criterioSucesso.id} - Nível ${violacao.nivelConformidadeCriterio})</h4>
                    <p class="problema"><span class="label">Problema:</span> ${violacao.descricaoProblema}</p>
                    <div class="suggestion">
                        <p><span class="label">Sugestão:</span> ${violacao.sugestaoCorrecao}</p>
                    </div>
                    <p class="tipo-violacao"><em>Violação ${violacao.eProvavel ? 'Provável (Inferida)' : 'Visível Diretamente'}</em></p>
                </div>
            `;
        });
    } else {
        html += `<h3>Nenhuma violação identificada.</h3>`; // Removido o emoji de festa aqui também
    }

    return html;
}