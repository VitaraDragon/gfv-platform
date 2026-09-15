import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  parseFatturaPaXml,
  tryExtractFatturaPaFromPages,
  looksLikeFatturaPaXml,
  tryExtractXmlFromPdfBuffer,
} = require('../functions/config/tony-fatturapa.js');
const { normalizeExtractionResult } = require('../functions/config/tony-document-schemas.js');

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>01234567890</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Agri Forniture Srl</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>99999999999</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Azienda Agricola Destinataria</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-07-15</Data>
        <Numero>695/V0</Numero>
        <ImportoTotaleDocumento>27.14</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
      <DatiDDT>
        <NumeroDDT>1490/00</NumeroDDT>
        <DataDDT>2026-07-10</DataDDT>
        <RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>
      </DatiDDT>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>UREA46</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Urea 46% sacchi</Descrizione>
        <Quantita>10.00</Quantita>
        <UnitaMisura>KG</UnitaMisura>
        <PrezzoUnitario>2.50</PrezzoUnitario>
        <PrezzoTotale>25.00</PrezzoTotale>
        <AliquotaIVA>4.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Spese spedizione</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>NR</UnitaMisura>
        <PrezzoUnitario>1.10</PrezzoUnitario>
        <PrezzoTotale>1.10</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>4.00</AliquotaIVA>
        <ImponibileImporto>25.00</ImponibileImporto>
        <Imposta>1.00</Imposta>
      </DatiRiepilogo>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1.10</ImponibileImporto>
        <Imposta>0.24</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

describe('tony-fatturapa', () => {
  it('riconosce XML FatturaPA', () => {
    expect(looksLikeFatturaPaXml(SAMPLE_XML)).toBe(true);
    expect(looksLikeFatturaPaXml('<html></html>')).toBe(false);
  });

  it('estrae fornitore (cedente, non destinatario), numero, DDT e righe', () => {
    const out = parseFatturaPaXml(SAMPLE_XML);
    expect(out.tipoDocumento).toBe('fattura');
    expect(out.fonteEstrazione).toBe('fatturapa');
    expect(out.fornitore.nome).toBe('Agri Forniture Srl');
    expect(out.fornitore.piva).toBe('01234567890');
    expect(out.numeroDocumento).toBe('695/V0');
    expect(out.dataDocumento).toBe('2026-07-15');
    expect(out.righe).toHaveLength(2);
    expect(out.righe[0].descrizione).toMatch(/Urea/);
    expect(out.righe[0].codiceFornitore).toBe('UREA46');
    expect(out.righe[0].quantita).toBe(10);
    expect(out.righe[0].prezzoUnitario).toBe(2.5);
    expect(out.righe[0].riferimentoBolla.numeroDocumento).toBe('1490/00');
    expect(out.righe[1].descrizione).toMatch(/spedizione/i);
    expect(out.riferimentiBolla[0].numeroDocumento).toBe('1490/00');
    expect(out.totali.imponibile).toBe(26.1);
    expect(out.totali.iva).toBe(1.24);
    expect(out.totali.totale).toBe(27.14);
  });

  it('normalizza verso schema GFV', () => {
    const out = normalizeExtractionResult(parseFatturaPaXml(SAMPLE_XML));
    expect(out.fonteEstrazione).toBe('fatturapa');
    expect(out.righe[0].unita).toBe('KG');
    expect(out.riferimentiBolla).toHaveLength(1);
  });

  it('tryExtractFatturaPaFromPages su pagina XML base64', () => {
    const data = Buffer.from(SAMPLE_XML, 'utf8').toString('base64');
    const parsed = tryExtractFatturaPaFromPages([
      { mimeType: 'application/xml', data, indice: 1 },
    ]);
    expect(parsed).not.toBeNull();
    expect(parsed.numeroDocumento).toBe('695/V0');
    expect(parsed.righe).toHaveLength(2);
  });

  it('estrae XML FatturaPA da buffer PDF con XML in chiaro', () => {
    const wrapped = '%PDF-1.4\n' + SAMPLE_XML + '\n%%EOF';
    const xml = tryExtractXmlFromPdfBuffer(Buffer.from(wrapped, 'utf8'));
    expect(xml).toBeTruthy();
    expect(parseFatturaPaXml(xml).numeroDocumento).toBe('695/V0');
  });

  it('non scambia 1490/00 con un numero approssimato', () => {
    expect(parseFatturaPaXml(SAMPLE_XML).riferimentiBolla[0].numeroDocumento).toBe('1490/00');
  });
});
