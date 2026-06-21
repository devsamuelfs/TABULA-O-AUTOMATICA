 // ==========================================
    // ESTADO GLOBAL DO PAINEL
    // ==========================================
    let currentAcordoType = '';
    let currentActiveTab = 'atendimento';

    let calcMemoryValue = '';
    let calcCurrentOp = '';
    let calcResetDisplay = false;

    let dataAtualCalendario = new Date();

    // Rascunho automático dos campos do modal (evita perda de dados ao fechar por acidente)
    let modalDrafts = {};
    const DRAFT_STORAGE_KEY = 'pefisa_modal_drafts_v1';

    // Lista de acordos acumulados na Tabulação Combinada
    let comboAcordos = [];
    const COMBO_STORAGE_KEY = 'pefisa_combo_acordos_v1';

    // Nomes legíveis de cada tipo de acordo (usados na Tabulação Combinada)
    const ACORDO_LABELS = {
        promessa: '🤝 Promessa de Pagamento',
        parcelamento: '📊 Parcelamento de Fatura',
        bacen: '🏛️ Parcelamento BACEN',
        saldo: '💳 Acordo Saldo Total',
        reneg: '🔄 Acordo RENEG',
        arrasto_vista: '🚀 Arrasto - À Vista',
        arrasto_parcelado: '🚀 Arrasto - Parcelado'
    };

    // Mapa do tipo de acordo -> id do textarea individual correspondente
    const ACORDO_TEXTAREA_IDS = {
        promessa: 'tab_promessa',
        parcelamento: 'tab_parcFatura',
        bacen: 'tab_bacen',
        saldo: 'tab_saldoTotal',
        reneg: 'tab_reneg',
        arrasto_vista: 'tab_arrasto_vista',
        arrasto_parcelado: 'tab_arrasto_parcelado'
    };

    // ==========================================
    // AUXILIARES E DOM
    // ==========================================
    function getCalcDisplay() {
        return document.getElementById('calcDisplay');
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', targetTheme);
    }

    function mostrarToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    // ==========================================
    // RASCUNHO AUTOMÁTICO DO MODAL
    // (evita perder o que foi digitado se o modal for fechado por acidente)
    // ==========================================
    function loadDraftsFromStorage() {
        try {
            const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
            modalDrafts = raw ? JSON.parse(raw) : {};
        } catch (e) {
            modalDrafts = {};
        }
    }

    function persistDrafts() {
        try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(modalDrafts)); } catch (e) {}
    }

    function saveCurrentModalDraft() {
        if (!currentAcordoType) return;
        const container = document.getElementById('modalFields');
        if (!container) return;
        const dados = {};
        let temAlgo = false;
        container.querySelectorAll('input, select').forEach(el => {
            if (!el.id) return;
            dados[el.id] = el.value;
            if (el.value) temAlgo = true;
        });
        if (temAlgo) {
            modalDrafts[currentAcordoType] = dados;
        } else {
            delete modalDrafts[currentAcordoType];
        }
        persistDrafts();
    }

    function restoreModalDraft(type) {
        const dados = modalDrafts[type];
        if (!dados) return false;
        let restaurouAlgo = false;
        Object.keys(dados).forEach(id => {
            const el = document.getElementById(id);
            if (el && dados[id]) {
                el.value = dados[id];
                restaurouAlgo = true;
            }
        });
        return restaurouAlgo;
    }

    function clearModalDraft(type) {
        delete modalDrafts[type];
        persistDrafts();
    }

    // ==========================================
    // TABULAÇÃO COMBINADA (MÚLTIPLOS ACORDOS/CARTÕES)
    // ==========================================
    function persistirCombo() {
        try { localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify(comboAcordos)); } catch (e) {}
    }

    function loadComboFromStorage() {
        try {
            const raw = localStorage.getItem(COMBO_STORAGE_KEY);
            comboAcordos = raw ? JSON.parse(raw) : [];
        } catch (e) {
            comboAcordos = [];
        }
    }

    function renderCombo() {
        const badge = document.getElementById('comboCount');
        if (badge) {
            if (comboAcordos.length > 0) {
                badge.innerText = comboAcordos.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        const textarea = document.getElementById('tab_combinada');
        if (!textarea) return;

        if (comboAcordos.length === 0) {
            textarea.value = '';
            return;
        }

        const blocos = comboAcordos.map((item, idx) => {
            return `===== ACORDO ${idx + 1}: ${item.label} (Cartão: ${item.cartao}) =====\n${item.texto}`;
        });
        textarea.value = blocos.join('\n\n');
    }

    function adicionarAoCombo() {
        if (!ACORDO_TEXTAREA_IDS[currentAcordoType]) return; // só faz sentido para tipos de acordo reais

        const vals = coletarValoresModal();
        const texto = montarTextoAcordo(currentAcordoType, vals);
        if (!texto) return;

        // Aplica normalmente também no card individual e nos SMS/E-mail (igual ao "Salvar e Aplicar")
        aplicarTabulacaoIndividual(currentAcordoType, vals);

        comboAcordos.push({
            tipo: currentAcordoType,
            label: ACORDO_LABELS[currentAcordoType] || currentAcordoType,
            texto: texto,
            cartao: vals.cartao
        });
        persistirCombo();
        renderCombo();
        clearModalDraft(currentAcordoType);
        closeModal();
        mostrarToast(`➕ Adicionado à Tabulação Combinada (${comboAcordos.length} ${comboAcordos.length === 1 ? 'acordo' : 'acordos'})`);
    }

    function removerUltimoCombo() {
        if (comboAcordos.length === 0) return;
        comboAcordos.pop();
        persistirCombo();
        renderCombo();
        mostrarToast('↩️ Último acordo removido da combinada');
    }

    function limparCombo() {
        if (comboAcordos.length === 0) return;
        if (!confirm('Limpar toda a Tabulação Combinada? Essa ação não pode ser desfeita.')) return;
        comboAcordos = [];
        persistirCombo();
        renderCombo();
        mostrarToast('🗑️ Tabulação combinada limpa');
    }

    // ==========================================
    // GERENCIAMENTO DE ABAS
    // ==========================================
    function switchTab(tabName) {
        currentActiveTab = tabName;
        
        // Alternar classes dos botões de controle
        document.getElementById('btnTabAtendimento')?.classList.toggle('active', tabName === 'atendimento');
        document.getElementById('btnTabSms')?.classList.toggle('active', tabName === 'sms');
        document.getElementById('btnTabCalc')?.classList.toggle('active', tabName === 'calc');
        document.getElementById('btnTabCalendario')?.classList.toggle('active', tabName === 'calendario');
        document.getElementById('btnTabUtilidades')?.classList.toggle('active', tabName === 'utilidades');
        
        // Alternar visibilidade das seções
        document.getElementById('secAtendimento').classList.toggle('hidden', tabName !== 'atendimento');
        document.getElementById('secSms').classList.toggle('hidden', tabName !== 'sms');
        document.getElementById('secCalc').classList.toggle('hidden', tabName !== 'calc');
        document.getElementById('secCalendario').classList.toggle('hidden', tabName !== 'calendario');
        document.getElementById('secUtilidades').classList.toggle('hidden', tabName !== 'utilidades');

        // Controle da barra de pesquisa global
        const searchBarContainer = document.getElementById('searchBarContainer');
        if (tabName === 'calc' || tabName === 'calendario' || tabName === 'utilidades') {
            if (searchBarContainer) searchBarContainer.style.display = 'none';
        } else {
            if (searchBarContainer) {
                searchBarContainer.style.display = 'block';
                const sb = document.getElementById('searchBar');
                if(sb) sb.value = '';
                filtrarCardsVisiveis('');
            }
        }

        // Gerenciamento inteligente de Foco da Calculadora
        if (tabName === 'calc') {
            setTimeout(() => {
                const disp = getCalcDisplay();
                if (disp) { 
                    disp.focus(); 
                    const length = disp.value.length;
                    disp.setSelectionRange(length, length);
                }
            }, 50);
        }

        // Inicialização do Calendário
        if (tabName === 'calendario') {
            renderizarCalendario();
        }
    }

    // ==========================================
    // SISTEMA DE PESQUISA
    // ==========================================
    function filtrarCardsVisiveis(valorBusca) {
        const query = valorBusca.toLowerCase().trim();
        const boxes = document.querySelectorAll('.tab-box');
        
        boxes.forEach(box => {
            if (box.getAttribute('data-category') === currentActiveTab) {
                const searchTags = box.getAttribute('data-search') ? box.getAttribute('data-search').toLowerCase() : "";
                const titleText = box.querySelector('.tab-title') ? box.querySelector('.tab-title').innerText.toLowerCase() : "";
                if (searchTags.includes(query) || titleText.includes(query)) { 
                    box.classList.remove('hidden'); 
                } else { 
                    box.classList.add('hidden'); 
                }
            }
        });
    }

    // ==========================================
    // MÓDULO DO CALENDÁRIO
    // ==========================================
    function renderizarCalendario() {
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const ano = dataAtualCalendario.getFullYear();
        const mesIndex = dataAtualCalendario.getMonth();
        
        const titulo = document.getElementById('calendarMonthYear');
        if (titulo) titulo.innerText = `${meses[mesIndex]} de ${ano}`;

        const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay();
        const ultimoDiaMes = new Date(ano, mesIndex + 1, 0).getDate();

        const containerDias = document.getElementById('calendarDays');
        if (!containerDias) return;
        containerDias.innerHTML = '';

        for (let i = 0; i < primeiroDiaSemana; i++) {
            const divVazia = document.createElement('div');
            divVazia.className = 'empty';
            containerDias.appendChild(divVazia);
        }

        const hoje = new Date();
        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            const divDia = document.createElement('div');
            divDia.innerText = dia;

            const dataChecagem = new Date(ano, mesIndex, dia);
            const diaSemana = dataChecagem.getDay();

            if (diaSemana === 0) divDia.className = 'weekend-sun';
            if (diaSemana === 6) divDia.className = 'weekend-sat';

            if (dia === hoje.getDate() && mesIndex === hoje.getMonth() && ano === hoje.getFullYear()) {
                divDia.classList.add('today');
            }

            containerDias.appendChild(divDia);
        }
    }

    function mudarMesCalendario(direcao) {
        dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + direcao);
        renderizarCalendario();
    }
// ==========================================
    // MÓDULO DA CALCULADORA
    // ==========================================
    function pressNum(num) {
        const disp = getCalcDisplay();
        if (!disp) return;
        if (disp.value === '0' || calcResetDisplay) {
            disp.value = num === ',' ? '0,' : num;
            calcResetDisplay = false;
        } else {
            if (num === ',' && disp.value.includes(',')) return;
            disp.value += num;
        }
        disp.focus();
    }

    function clearCalc() {
        const disp = getCalcDisplay();
        if (disp) disp.value = '0';
        calcMemoryValue = '';
        calcCurrentOp = '';
        calcResetDisplay = false;
        disp?.focus();
    }

    function pressOp(op) {
        const disp = getCalcDisplay();
        if (!disp) return;
        let sinalTela = op === '*' ? ' × ' : op === '/' ? ' ÷ ' : ` ${op} `;
        let valorLimpo = disp.value.trim().replace(/\./g, '').replace(/,/g, '.');
        
        if(!isNaN(parseFloat(valorLimpo)) && !disp.value.includes('+') && !disp.value.includes('-') && !disp.value.includes('*') && !disp.value.includes('/')) {
            calcMemoryValue = valorLimpo;
            calcCurrentOp = op;
            disp.value += sinalTela;
        } else {
            disp.value += sinalTela;
        }
        calcResetDisplay = false;
        disp.focus();
    }

    function calculateResult() {
        const disp = getCalcDisplay();
        if (!disp) return;
        let expressaoOriginal = disp.value.trim();
        if (!expressaoOriginal) return;

        let expressaoProcessada = expressaoOriginal
            .replace(/\./g, '') 
            .replace(/,/g, '.') 
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

        try {
            let resultadoReal = Function(`"use strict"; return (${expressaoProcessada})`)();
            
            if (resultadoReal === undefined || isNaN(resultadoReal) || !isFinite(resultadoReal)) {
                throw new Error();
            }

            resultadoReal = Math.round(resultadoReal * 10000) / 10000;

            adicionarAoHistorico(`${expressaoOriginal} = ${resultadoReal.toString().replace('.', ',')}`);
            disp.value = resultadoReal.toString().replace('.', ',');
        } catch (e) {
            disp.value = "Erro de sintaxe";
            setTimeout(() => { disp.value = "0"; }, 1300);
        }

        calcCurrentOp = '';
        calcMemoryValue = '';
        calcResetDisplay = true;
        disp.focus();
    }

    function adicionarAoHistorico(texto) {
        const historyLog = document.getElementById('calcHistoryLog');
        if (historyLog) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.style.borderBottom = '1px dashed var(--border)';
            itemDiv.style.paddingBottom = '2px';
            itemDiv.innerText = texto;
            historyLog.prepend(itemDiv);
        }
    }
        
    function handleCalcKeyboard(event) {
        const disp = getCalcDisplay();
        if (!disp) return;

        // Detecta números (tanto do teclado normal quanto do numérico lateral)
        const isNumero = /^[0-9]$/.test(event.key);
        const isOperador = ['+', '-', '*', '/'].includes(event.key);
        const isVirgula = event.key === ',' || event.key === '.';

        // Lista de teclas que a nossa calculadora vai controlar manualmente
        const teclasControladas = [
            'Backspace', 'Enter', '=', 'Escape', 'c', 'C'
        ];

        // Se for qualquer tecla que a calculadora usa, cancela a ação nativa do navegador imediatamente
        if (isNumero || isOperador || isVirgula || teclasControladas.includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            event.returnValue = false; 
        } else {
            // Deixa passar comandos do sistema como Tab, Setas, F5, etc.
            return; 
        }

        // Lógica de Reset / Erro
        if (disp.value === "Erro de sintaxe" || calcResetDisplay) {
            if (event.key !== 'Enter' && event.key !== 'Escape') {
                disp.value = "";
                calcResetDisplay = false;
                if (event.key === 'Backspace') {
                    disp.value = "0";
                    return;
                }
            }
        }

        // Ação do Backspace (Apagar)
        if (event.key === 'Backspace') {
            let currentVal = disp.value;
            if (currentVal.endsWith(' ')) {
                disp.value = currentVal.slice(0, -3); 
            } else {
                disp.value = currentVal.slice(0, -1);
            }
            if (disp.value === "" || disp.value === "-") disp.value = "0";
            return;
        }

        // Processamento de entradas via funções nativas do script
        if (isNumero) {
            pressNum(event.key);
        }
        else if (isVirgula) {
            pressNum(',');
        }
        else if (event.key === '+') { pressOp('+'); }
        else if (event.key === '-') { pressOp('-'); }
        else if (event.key === '*') { pressOp('*'); }
        else if (event.key === '/') { pressOp('/'); }
        else if (event.key === 'Enter' || event.key === '=') {
            calculateResult();
        }
        else if (event.key.toLowerCase() === 'c' || event.key === 'Escape') {
            clearCalc();
        }
    }
    // ==========================================
    // MÁSCARAS DE ENTRADA
    // ==========================================
    function formatarMoeda(input) {
        let valor = input.value.replace(/\D/g, "");
        if (!valor) { input.value = ""; return; }
        valor = (valor / 100).toFixed(2) + "";
        valor = valor.replace(".", ",");
        valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        input.value = valor;
    }

    function formatarData(input) {
        let v = input.value.replace(/\D/g, ""); 
        if (v.length >= 5) { v = v.replace(/^(\d{2})(\d{2})(\d{1,4})$/, "$1/$2/$3"); }
        else if (v.length >= 3) { v = v.replace(/^(\d{2})(\d{1,2})$/, "$1/$2"); }
        input.value = v.substring(0, 10);
    }

    // ==========================================
    // ENGENHARIA DO MODAL & AUTOMAÇÃO
    // ==========================================
    function openModal(type) {
        currentAcordoType = type;
        const container = document.getElementById('modalFields');
        const title = document.getElementById('modalTitle');
        if (!container || !title) return;
        container.innerHTML = ''; 

        const cartaoBase = `<div class="field"><label>Nome do Cartão</label></div>`;
        const dataBase = `<div class="field"><label>Data de Vencimento / Pagamento</label><input type="text" id="dynData" oninput="formatarData(this)" placeholder="Ex: 08062026"></div>`;

        if (type === 'promessa') {
            title.innerText = "🤝 Configurar Promessa de Pagamento";
            container.innerHTML = cartaoBase + `<div class="field"><label>Valor Total / Fatura (R$)</label><input type="text" id="dynValor" oninput="formatarMoeda(this)" placeholder="0,00"></div>` + dataBase;
        } 
        else if (type === 'parcelamento' || type === 'bacen' || type === 'saldo') {
            title.innerText = `📊 Configurar Acordo / Fatura`;
            container.innerHTML = cartaoBase + `
                <div class="field"><label>Quantidade de Parcelas (X)</label><input type="number" id="dynParcelas" value="1"></div>
                <div class="field"><label>Valor da Parcela (R$)</label><input type="text" id="dynValorParcela" oninput="formatarMoeda(this)" placeholder="0,00"></div>
            ` + dataBase;
        }
        else if (type === 'reneg') {
            title.innerText = "🔄 Configurar Acordo RENEG";
            container.innerHTML = cartaoBase + `
                <div class="field"><label>Valor Total da Dívida (R$)</label><input type="text" id="dynValor" oninput="formatarMoeda(this)" placeholder="0,00"></div>
                <div class="field"><label>Quantidade de Parcelas</label><input type="number" id="dynParcelas" value="1"></div>
                <div class="field"><label>Valor da Parcela (R$)</label><input type="text" id="dynValorParcela" oninput="formatarMoeda(this)" placeholder="0,00"></div>
            ` + dataBase;
        } 
        else if (type === 'arrasto_vista') {
            title.innerText = "🚀 Configurar Acordo Arrasto - À Vista";
            container.innerHTML = cartaoBase + `
                <div class="field"><label>Valor À Vista (R$)</label><input type="text" id="dynValor" oninput="formatarMoeda(this)" placeholder="0,00"></div>
                <div class="field"><label>Data Limite do À Vista</label><input type="text" id="dynData" oninput="formatarData(this)" placeholder="dd/mm/aaaa"></div>
            `;
        } 
        else if (type === 'arrasto_parcelado') {
            title.innerText = "🚀 Configurar Acordo Arrasto - Parcelado";
            container.innerHTML = cartaoBase + `
                <div class="field"><label>Valor Entrada (R$)</label><input type="text" id="dynEntrada" oninput="formatarMoeda(this)" placeholder="0,00"></div>
                <div class="field"><label>Data da Entrada</label><input type="text" id="dynDataEntrada" oninput="formatarData(this)" placeholder="dd/mm/aaaa"></div>
                <div class="field"><label>Qtd Parcelas Restantes</label><input type="number" id="dynParcelas" value="1" min="1"></div>
                <div class="field"><label>Valor das Parcelas (R$)</label><input type="text" id="dynValorParcela" oninput="formatarMoeda(this)" placeholder="0,00"></div>
                <div class="field"><label>Data Limite das Parcelas</label><input type="text" id="dynData" oninput="formatarData(this)" placeholder="dd/mm/aaaa"></div>
            `;
        }
        else if (type === 'outros') {
            title.innerText = "📝 Atrasos e Outras Ocorrências";
            container.innerHTML = cartaoBase + `
                <div class="field"><label>Dias em Atraso</label><input type="number" id="dynDiasAtraso" placeholder="Ex: 95"></div>
                <div class="field"><label>Valor Envolvido (R$)</label><input type="text" id="dynValor" oninput="formatarMoeda(this)" placeholder="0,00"></div>
                <div class="field"><label>Data de Referência</label><input type="text" id="dynData" oninput="formatarData(this)"></div>
            `;
        }

        container.innerHTML += `<div class="field"><label>Código de Barras ou PIX (Opcional)</label><input type="text" id="dynCodigo" placeholder="Cole o código aqui"></div>`;
        
        const targetCartaoField = container.querySelector('.field');
        if (targetCartaoField) {
            targetCartaoField.innerHTML = `
                <label for="dynCartao" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text); font-family: inherit; font-size: 14px;">Nome do Cartão</label>
                <select id="dynCartao" class="custom-select">
                    <option value="" disabled selected>Selecione um cartão...</option>
                    <optgroup label="Pernambucanas">
                        <option value="Pernambucanas Elo">Pernambucanas Elo</option>
                        <option value="Pernambucanas Elo Mais">Pernambucanas Elo Mais</option>
                        <option value="Pernambucanas Elo Grafite">Pernambucanas Elo Grafite</option>
                    </optgroup>
                    <optgroup label="Padrão / Digital">
                        <option value="STANDARD">STANDARD</option>   
                        <option value="PL Digital">Pl Digital</option>                             
                    </optgroup>
                    <optgroup label="Celebre!">
                        <option value="Celebre! Elo Mais">Celebre! Elo Mais</option>
                        <option value="Celebre! Elo Grafite">Celebre! Elo Grafite</option>
                        <option value="Celebre! Pro Elo Mais">Celebre! Pro Elo Mais</option>
                        <option value="Celebre! Elo Nanquim">Celebre! Elo Nanquim</option>
                    </optgroup>
                    <optgroup label="Parcerias">
                        <option value="CARTÃO PALMEIRAS ELO MAIS">CARTÃO PALMEIRAS ELO MAIS</option>
                        <option value="Carmen Steffens ELO">Carmen Steffens ELO</option>
                        <option value="Carmen Steffens ELO Grafite">Carmen Steffens ELO Grafite</option>
                        <option value="Carmen Steffens ELO Nanquim">Carmen Steffens ELO Nanquim</option>
                    </optgroup>
                    <optgroup label="Elo Geral">
                        <option value="Elo">Elo</option>
                        <option value="Elo Mais">Elo Mais</option>
                    </optgroup>
                    <optgroup label="Outros">
                        <option value="CP RENEGOCIACAO">CP RENEGOCIACAO</option>
                        <option value="Emprestimo">Emprestimo</option>
                    </optgroup>
                </select> `;
        }

        document.getElementById('modalAutomacao').style.display = 'flex';

        // Mostra o atalho "Adicionar à Tabulação Combinada" só para tipos que são de fato acordos
        const comboDivider = document.getElementById('modalActionsCombo');
        if (comboDivider) {
            comboDivider.classList.toggle('hidden', !ACORDO_TEXTAREA_IDS[type]);
        }

        // Restaura rascunho salvo automaticamente, se houver
        const rascunhoRestaurado = restoreModalDraft(type);
        if (rascunhoRestaurado) {
            setTimeout(() => mostrarToast('📝 Rascunho anterior restaurado automaticamente'), 150);
        }
    }

    function closeModal() { document.getElementById('modalAutomacao').style.display = 'none'; }
    function closeModalOutside(e) { if(e.target.id === 'modalAutomacao') closeModal(); }

    // Cancelar fecha o modal e descarta o rascunho de propósito
    // (diferente de clicar fora por acidente, que mantém o rascunho salvo)
    function cancelModal() {
        clearModalDraft(currentAcordoType);
        closeModal();
    }

    function coletarValoresModal() {
        return {
            cartao: document.getElementById('dynCartao')?.value || 'Pernambucanas Elo',
            valor: document.getElementById('dynValor')?.value || 'xxx,xx',
            data: document.getElementById('dynData')?.value || 'xx/xx/xxxx',
            parcelas: document.getElementById('dynParcelas')?.value || 'X',
            valorParcela: document.getElementById('dynValorParcela')?.value || 'XXX,XX',
            entrada: document.getElementById('dynEntrada')?.value || 'XXX,XX',
            dataEntrada: document.getElementById('dynDataEntrada')?.value || 'xx/xx/xxxx',
            diasAtraso: document.getElementById('dynDiasAtraso')?.value || 'X',
            codigo: document.getElementById('dynCodigo')?.value || 'xxxxx xxxxx xxxxx xxxxx'
        };
    }

    // Gera só o texto do acordo (sem tocar em SMS/E-mail) - usado tanto no fluxo normal quanto na combinada
    function montarTextoAcordo(type, vals) {
        const { cartao, valor, data, parcelas, valorParcela, entrada, dataEntrada } = vals;

        if (type === 'promessa') {
            return `RECEPTIVO -PROMESSA DE PAGAMENTO (minimo e valor total)\nCliente irá efetuar o pagamento de fatura no valor de R$ ${valor}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        if (type === 'parcelamento') {
            return `RECEPTIVO -PARCELAMENTO EM FATURA\nCliente fez o parcelamento da fatura em ${parcelas} vezes no valor de R$ ${valorParcela}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        if (type === 'bacen') {
            let dataCurta = data.substring(0, 5);
            return `RECEPTIVO – PARCELAMENTO BACEN\nComo promessa de pagamento, cliente efetivará acordo automático BACEN no valor de R$ ${valorParcela} para pagamento até dia ${dataCurta}.\nReferente ao cartão ${cartao}`;
        }
        if (type === 'saldo') {
            return `RECEPTIVO – AGENDAMENTO ACORDO SALDO TOTAL\nCliente fez o parcelamento do saldo total em ${parcelas} vezes no valor de R$ ${valorParcela}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        if (type === 'reneg') {
            return `RECEPTIVO – ACORDO RENEG\nCliente fez o parcelamento do saldo total (Renegociação) no valor de R$ ${valor}\nem ${parcelas} vezes no valor de R$ ${valorParcela}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        if (type === 'arrasto_vista') {
            return `RECEPTIVO – ACORDO ARRASTO À VISTA\nCliente fez o acordo arrasto à vista no valor de R$ ${valor}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        if (type === 'arrasto_parcelado') {
            return `RECEPTIVO – ACORDO ARRASTO PARCELADO\nCliente fez o acordo arrasto no valor de entrada R$ ${entrada}\nPara pagamento da entrada até o dia: ${dataEntrada}\n+ ${parcelas} vezes no valor de R$ ${valorParcela}\nPara pagamento até o dia: ${data}\nReferente ao cartão ${cartao}`;
        }
        return '';
    }

    // Aplica o acordo no card individual + atualiza SMS/E-mail (igual ao comportamento original do "Salvar e Aplicar")
    function aplicarTabulacaoIndividual(type, vals) {
        const { cartao, valor, data, parcelas, valorParcela, diasAtraso, codigo } = vals;

        if (type === 'outros') {
            const campo91dias = document.getElementById('tab_91dias');
            const campoAlegaPago = document.getElementById('tab_alegaPago');
            const campoSegundaVia = document.getElementById('tab_segundaVia');
            const campoForaPrazo = document.getElementById('tab_foraPrazo');

            if (campo91dias) campo91dias.value = `RECEPTIVO – ACIMA DE 91 DIAS\nCliente com ${diasAtraso} dias em atraso, informado o contato da central ESCOBS (91+): 0800 941 0047 ou 0800 202 0306.`;
            if (campoAlegaPago) campoAlegaPago.value = `RECEPTIVO – ALEGA TER PAGO ENVIARA COMPROVANTE\nCliente solicitou informações, e sobre débito em atraso, alega que pagou o valor de R$ ${valor} no dia ${data} no cartão ${cartao} foi enviado as seguintes informações pra ela\n\nSEGUE O EMAIL PARA ENCAMINHAR O COMPROVANTE DE PAGAMENTO\nevidenciaspefisa@concilig.com.br\nNOME COMPLETO\nCPF\nDATA DE PAGAMENTO\nCOMPROVANTE DE PAGAMENTO (ANEXO)`;
            if (campoSegundaVia) campoSegundaVia.value = `RECEPTIVO – SEGUNDA VIA BOLETO\nCliente solicitou segunda via fatura (boleto).\nReferente ao cartão ${cartao}`;
            if (campoForaPrazo) campoForaPrazo.value = `RECEPTIVO – FORA DO PRAZO\nImpossível gerar o boleto com a data solicitada, sendo necessário o pagamento imediato ou dentro do limite sistêmico.`;
        } else if (ACORDO_TEXTAREA_IDS[type]) {
            const campoAlvo = document.getElementById(ACORDO_TEXTAREA_IDS[type]);
            if (campoAlvo) campoAlvo.value = montarTextoAcordo(type, vals);
        }

        let vFinal = (type === 'parcelamento' || type === 'bacen' || type === 'saldo') ? valorParcela : valor;

        const smsM1 = document.getElementById('sms_barras_m1');
        const smsM2 = document.getElementById('sms_barras_m2');
        const pixM1 = document.getElementById('sms_pix_m1');
        const pixM2 = document.getElementById('sms_pix_m2');
        const emFatura = document.getElementById('email_fatura');
        const emParcelado = document.getElementById('email_parcelado');
        const emAcordo = document.getElementById('email_acordo');
        const emCp = document.getElementById('email_cp');

        if (smsM1) smsM1.value = `Prezado(a) cliente.\nSegue código de barras para pagamento no valor de R$ ${vFinal}\nPara pagamento no dia ${data}\nA Pefisa Pernambucanas agradece a sua atenção!`;
        if (smsM2) smsM2.value = `Código de barras: ${codigo}`;
        if (pixM1) pixM1.value = `Prezado(a) cliente.\nSegue código PIX para pagamento no valor de R$ ${vFinal}\nPara pagamento no dia ${data}\nA Pefisa Pernambucanas agradece a sua atenção!`;
        if (pixM2) pixM2.value = `Código PIX: ${codigo}`;

        if (emFatura) emFatura.value = `Prezado(a) cliente.\nSegue fatura para pagamento no valor de R$ ${vFinal}. Com o vencimento no dia ${data}.\n\nAtenção!\nCertifique-se de que o código do cedente é 174 e o beneficiário final é Pefisa S.A.\n\nEm caso de dúvidas entre em contato pelos números:\n4004-0066 (Capitais)\n0800 724 8400 (Demais regiões)\n\nSe preferir, vá até uma de nossas lojas ou acesse nosso portal:\nhttps://pagamentos.pefisa.com.br\n\nA Pefisa Pernambucanas agradece a sua atenção!`;
        if (emParcelado) emParcelado.value = `Prezado(a) cliente.\nSegue fatura para pagamento do parcelamento de (FATURA, SALDO TOTAL) em ${parcelas} vezes de R$ ${valorParcela}. Com o vencimento no dia ${data}.\n\nLembrando que na segunda parcela será cobrado o juros referente aos dias em atraso!\n\nAtenção!\nCertifique-se de que o código do cedente é 174 e o beneficiário final é Pefisa S.A.\n\nEm caso de dúvidas entre em contato pelos números:\n4004-0066 (Capitais)\n0800 724 8400 (Demais regiões)\n\nSe preferir, vá até uma de nossas lojas ou acesse nosso portal:\nhttps://pagamentos.pefisa.com.br\n\nA Pefisa Pernambucanas agradece a sua atenção!`;
        if (emAcordo) emAcordo.value = `Prezado(a) cliente.\nSegue boleto para pagamento no valor de R$ ${vFinal}. Com o vencimento no dia ${data}.\n\nAtenção!\nCertifique-se de que o código do cedente é 174 e o beneficiário final é Pefisa S.A.\n\nEm caso de dúvidas entre em contato pelos números:\n4004-0066 (Capitais)\n0800 724 8400 (Demais regiões)\n\nSe preferir, vá até uma de nossas lojas ou acesse nosso portal:\nhttps://pagamentos.pefisa.com.br\n\nA Pefisa Pernambucanas agradece a sua atenção!`;
        if (emCp) emCp.value = `Prezado(a) cliente.\nSegue boleto para pagamento da renegociação feita em ${parcelas} vezes no valor de R$ ${valorParcela}. Com o vencimento no dia ${data}.\n\nAtenção!\nCertifique-se de que o código do cedente é 174 e o beneficiário final é Pefisa S.A.\n\nEm caso de dúvidas entre em contato pelos números:\n4004-0066 (Capitais)\n0800 724 8400 (Demais regiões)\n\nSe preferir, vá até uma de nossas lojas ou acesse nosso portal:\nhttps://pagamentos.pefisa.com.br\n\nA Pefisa Pernambucanas agradece a sua atenção!`;
    }

    function processarDadosDinamicos() {
        const vals = coletarValoresModal();
        aplicarTabulacaoIndividual(currentAcordoType, vals);

        clearModalDraft(currentAcordoType);
        closeModal();
        mostrarToast("✨ Scripts updated!");
    }

    // ==========================================
    // ENGENHARIA DE CLIPBOARD

    // ==========================================
    function copiarTextoDireto(idCampo) {
        const txtArea = document.getElementById(idCampo);
        if (!txtArea) return;
        txtArea.select();
        txtArea.setSelectionRange(0, 99999);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        mostrarToast("📋 Script Copiado!");
    }

    // ==========================================
    // EVENTOS GLOBAIS E INICIALIZAÇÃO
    // ==========================================
    document.addEventListener("DOMContentLoaded", function() {
        // Carrega rascunhos e Tabulação Combinada salvos de sessões anteriores
        loadDraftsFromStorage();
        loadComboFromStorage();
        renderCombo();

        // Ouvinte da Calculadora Blindado contra Duplicação
        const disp = getCalcDisplay();
        if (disp) {
            disp.removeEventListener('keydown', handleCalcKeyboard);
            disp.addEventListener('keydown', handleCalcKeyboard);
        }

        // Ouvinte da Barra de Pesquisa
        document.getElementById('searchBar')?.addEventListener('input', function(e) {
            filtrarCardsVisiveis(e.target.value);
        });

        // Salva o rascunho automaticamente a cada alteração nos campos do modal
        const modalFieldsContainer = document.getElementById('modalFields');
        if (modalFieldsContainer) {
            modalFieldsContainer.addEventListener('input', saveCurrentModalDraft);
            modalFieldsContainer.addEventListener('change', saveCurrentModalDraft);
        }
    });

    // Manipulador de cliques global (Cópia de contatos das utilidades)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('btn-copy-util')) {
            e.preventDefault();
            const card = e.target.closest('.util-card');
            if (card) {
                const nomeCentral = card.querySelector('h4').innerText.trim();
                const paragrafos = card.querySelectorAll('p');
                let textoParaCopiar = `Central: ${nomeCentral}\n`;
                
                paragrafos.forEach(p => {
                    const linhaTexto = p.innerText.trim();
                    const textoMinusculo = linhaTexto.toLowerCase();
                    
                    if (!textoMinusculo.includes('horário') && 
                        !textoMinusculo.includes('horario') && 
                        !textoMinusculo.includes('atendimento:') && 
                        !textoMinusculo.includes('às') && 
                        !textoMinusculo.includes('as ')) {
                        textoParaCopiar += `${linhaTexto}\n`;
                    }
                });

                navigator.clipboard.writeText(textoParaCopiar.trim()).then(() => {
                    mostrarToast("📋 Dados copiados com sucesso!");
                });
            }
        }
    });

    // Atalhos globais de teclado (Modais e Fechamento)
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('modalAutomacao');
        if (modal && modal.style.display === 'flex') {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                processarDadosDinamicos(); 
            }
            if (e.key === 'Escape') { 
                closeModal(); 
            }
        }
    });