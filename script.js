function converteInDataIta(dataIso) {
    if (!dataIso) return "";
    const [anno, mese, giorno] = dataIso.split('-');
    return `${giorno}/${mese}/${anno}`;
}

async function caricaDatiCsv() {
    try {
        // Caricamento di entrambi i file CSV in parallelo
        const [rispostaDate, rispostaOrario] = await Promise.all([
            fetch('date_boleane.csv'),
            fetch('orario_materie.csv')
        ]);

        if (!rispostaDate.ok || !rispostaOrario.ok) {
            throw new Error("Impossibile caricare uno o più file CSV nella cartella.");
        }

        const testoDate = await rispostaDate.text();
        const testoOrario = await rispostaOrario.text();
        console.log(testoOrario);
        // 1. Elaborazione date_boleane.csv
        const righeDate = testoDate.trim().split('\n');

        // Estrazione della prima riga per completare l'intestazione in html (es. "2026/2027;5°I")
        let annoScolastico = "";
        let classeSezione = "";

        if (righeDate.length > 0) {
            const primaRigaConfig = righeDate[0].trim();
            if (primaRigaConfig) {
                const partiConfig = primaRigaConfig.split(';');
                annoScolastico = partiConfig[0] ? partiConfig[0].trim() : "";
                classeSezione = partiConfig[1] ? partiConfig[1].trim() : "";
            }
            // Rimuoviamo la prima riga così il ciclo successivo parte dalle date
            righeDate.shift();
        }

        // Popoliamo subito l'intestazione HTML con i dati trovati nel CSV
        document.getElementById('annoScolastico').textContent = annoScolastico;
        document.getElementById('classeSezione').textContent = classeSezione;

        const n_gg_date = [];
        for (let riga of righeDate) {
            riga = riga.trim();
            if (riga) {
                const parti = riga.split(';');
                n_gg_date.push([parti[0], parseInt(parti[1])]);
            }
        }

        // 2. Elaborazione orario_materie.csv
        const righeOrario = testoOrario.trim().split('\n');
        let intestazioneOrari = [];
        const orarioMap = {};

        for (let i = 0; i < righeOrario.length; i++) {
            let riga = righeOrario[i].trim();
            if (riga) {
                const parti = riga.split(';');
                if (i === 0) {
                    // La prima riga contiene gli orari: 18:00; 19:00; ecc. (puliti da spazi)
                    intestazioneOrari = parti.slice(1).map(ora => ora.trim());
                } else {
                    // La prima colonna è il giorno: normalizzata (minuscola, senza accenti e spazi)
                    const giornoKey = parti[0].trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    orarioMap[giornoKey] = parti.slice(1);
                }
            }
        }

        // Primo avvio immediato appena i dati sono caricati
        elaboraEVisualizza(n_gg_date, intestazioneOrari, orarioMap);

        // Aggiornamento automatico ogni secondo. Uso una arrow function per riuscire a passare i parametri
        setInterval(() => {
            elaboraEVisualizza(n_gg_date, intestazioneOrari, orarioMap);
        }, 1000);

    } catch (errore) {
        document.getElementById('app').innerHTML = `<p style="color: red; text-align: center;">Errore: ${errore.message}<br><small>Verifica che i file CSV siano nella cartella.</small></p>`;
    }
}

function elaboraEVisualizza(n_gg_date, intestazioneOrari, orarioMap) {
    ////////////////////////////////////////////////////////////
    // Modalità di Sviluppo / Debug
    const BEBUG = false;
    ////////////////////////////////////////////////////////////

    let data_oggi_iso, oraAttuale, minutiAttuali, secondiAttuali;

    if (BEBUG === true) { // PER FARE TEST
        data_oggi_iso = '2026-09-15';
        oraAttuale = 21;
        minutiAttuali = 0;
        secondiAttuali = 0;
    } else {
        const dataItaliana = new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" });
        const adesso = new Date(dataItaliana);
        const anno = adesso.getFullYear();
        const mese = String(adesso.getMonth() + 1).padStart(2, '0');
        const giorno = String(adesso.getDate()).padStart(2, '0');
        data_oggi_iso = `${anno}-${mese}-${giorno}`;
        oraAttuale = adesso.getHours();
        minutiAttuali = adesso.getMinutes();
        secondiAttuali = adesso.getSeconds();
    }

    let ora_stampa = oraAttuale < 10 ? "0" + oraAttuale : oraAttuale;
    let minuti_stampa = minutiAttuali < 10 ? "0" + minutiAttuali : minutiAttuali;
    let secondi_stampa = secondiAttuali < 10 ? "0" + secondiAttuali : secondiAttuali;
    let orario_stampa = ora_stampa + ":" + minuti_stampa + ":" + secondi_stampa;

    const data_oggi_ita = converteInDataIta(data_oggi_iso);
    const inizio_scuola = n_gg_date[0][0];
    const fine_scuola = n_gg_date[n_gg_date.length - 1][0];

    // --- GESTIONE DEL GIORNO CORRENTE ---
    const [annoIso, meseIso, giornoIso] = data_oggi_iso.split('-').map(Number);
    const dataRiferimento = new Date(annoIso, meseIso - 1, giornoIso);
    let nomeGiornoOggiStampa = dataRiferimento.toLocaleDateString('it-IT', { weekday: 'long' });
    let nomeGiornoOggi = nomeGiornoOggiStampa.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // -------------------------------------------------------------

    // Stato della lezione odierna ottenuta direttamente da date_boleane.csv
    let gg_totali = 0;
    let attivitaOggi = -1;
    let gg_fatti = 0;
    let flag = true;

    for (let i = 0; i < n_gg_date.length; i++) {
        const dataRiga = n_gg_date[i][0];
        const lezioneProgrammata = n_gg_date[i][1];

        gg_totali += lezioneProgrammata;

        if (dataRiga === data_oggi_iso) {
            attivitaOggi = lezioneProgrammata;
        }

        if (dataRiga < data_oggi_iso) {
            gg_fatti += lezioneProgrammata;
        } else if (dataRiga === data_oggi_iso) {
            if (lezioneProgrammata === 1 && oraAttuale >= 23) {
                gg_fatti += 1;
            }
        }
    }

    if (data_oggi_iso > fine_scuola) {
        gg_fatti = gg_totali;
        flag = false;
    }

    const rimanenti = Math.max(0, gg_totali - gg_fatti);
    const perc_trascorsa = (gg_fatti / gg_totali) * 100;
    const perc_rimanente = (rimanenti / gg_totali) * 100;

    let materiaInCorso = "";
    let testo_lezione = "";

    if (!flag || data_oggi_iso > fine_scuola) {
        testo_lezione = "SCUOLA FINITA";
    } else if (attivitaOggi === 0) {
        testo_lezione = "Oggi NON è programmata nessuna lezione!";
    } else if (attivitaOggi === -1) {
        testo_lezione = "Data odierna non presente nel calendario scolastico.";
    } else {
        if (oraAttuale < 18) {
            testo_lezione = "🔴 Stasera sono previste lezioni (dalle 18:00)!";
        } else if (oraAttuale >= 23) {
            testo_lezione = "Lezioni di stasera terminate.";
        } else {
            const rigaOrarioGiorno = orarioMap[nomeGiornoOggi];

            if (rigaOrarioGiorno) {
                let indiceSlotAttivo = -1;
                const minutiCorrentiTotali = oraAttuale * 60 + minutiAttuali;

                for (let j = 0; j < intestazioneOrari.length; j++) {
                    const partiOra = intestazioneOrari[j].split(':');
                    if (partiOra.length === 2) {
                        const minSlotInizio = parseInt(partiOra[0]) * 60 + parseInt(partiOra[1]);
                        if (minutiCorrentiTotali >= minSlotInizio) {
                            indiceSlotAttivo = j;
                        }
                    }
                }

                if (indiceSlotAttivo !== -1) {
                    const voceTrovata = rigaOrarioGiorno[indiceSlotAttivo];
                    if (voceTrovata && voceTrovata.toLowerCase() !== 'nullo') {
                        materiaInCorso = voceTrovata;
                    }
                }
            }

            if (materiaInCorso !== "") {
                testo_lezione = `🔴 Attività ora in corso: <strong>${materiaInCorso}</strong>`;
            } else {
                testo_lezione = "Lezioni terminate per stasera.";
            }
        }
    }

    // --- COSTRUZIONE DELLA LISTA MATERIE PER OGGI (solo se ci sono lezioni oggi) ---
    let elencoMaterieHtml = "";

    if (attivitaOggi === 1) {
        const rigaMaterieOGgi = orarioMap[nomeGiornoOggi];
        if (rigaMaterieOGgi) {
            let elementiLista = [];
            for (let k = 0; k < intestazioneOrari.length; k++) {
                const materia = rigaMaterieOGgi[k];
                const orarioSlot = intestazioneOrari[k];
                if (materia && materia.toLowerCase() !== 'nullo') {
                    elementiLista.push(`&bull; ${orarioSlot}: ${materia}`);
                }
            }
            if (elementiLista.length > 0) {
                elencoMaterieHtml = `<div class="report-row" style="flex-direction: column; align-items: flex-start;">
                    <span>Materie di oggi (${nomeGiornoOggiStampa}):</span>
                    <strong style="margin-top: 4px; font-weight: normal; line-height: 1.4;">${elementiLista.join('<br>')}</strong>
                </div>`;
            }
        }
    }
    // -----------------------------------------------------------------
    const percentualeBarra = (gg_fatti / gg_totali) * 100;
    const percentualeOggi = Math.min(100, Math.max(0, (gg_fatti / gg_totali) * 100));

    // Generazione HTML dell'interfaccia
    const html = `
        <div class="dates-info">
            <span>Inizio: ${converteInDataIta(inizio_scuola)}</span>
            <span>Fine: ${converteInDataIta(fine_scuola)}</span>
        </div>

        <div class="progress-container">
            <div class="progress-bar" style="width: ${percentualeBarra}%;"></div>
            <div class="today-marker" style="left: ${percentualeOggi}%;"></div>
            <div class="bar-text-fatti">${gg_fatti} gg (${perc_trascorsa.toFixed(1)}%)</div>
            <div class="bar-text-rimanenti">-${rimanenti} gg (${perc_rimanente.toFixed(1)}%)</div>
        </div>

        <div class="report-box">
            <h3>Report Riepilogativo</h3>
            <div class="report-row">
                <span>Giorno attuale:</span>
                <strong>${nomeGiornoOggiStampa}</strong>
            </div>
            <div class="report-row">
                <span>Data odierna:</span>
                <strong>${data_oggi_ita}</strong>
            </div>
            <div class="report-row">
                <span>Ora attuale:</span>
                <strong>${orario_stampa}</strong>
            </div>
            <div class="report-row">
                <span>Giorni Totali:</span>
                <strong>${gg_totali}</strong>
            </div>
            <div class="report-row">
                <span>Giorni Fatti:</span>
                <strong>${gg_fatti} (${perc_trascorsa.toFixed(2)}%)</strong>
            </div>
            <div class="report-row">
                <span>Giorni Rimanenti:</span>
                <strong>${rimanenti} (${perc_rimanente.toFixed(2)}%)</strong>
            </div>
            ${elencoMaterieHtml}
            <div class="status-msg">
                ${testo_lezione}
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = html;
}

// Avvio dell'app con il "caricatore multi-CSV"
caricaDatiCsv();