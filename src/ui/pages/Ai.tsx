// Una mano con IA: copiar contexto → conversar en tu chat favorito → pegar el JSON → revisar y aplicar.
import { useState } from 'react';
import { CheckCheck, CheckCircle2, Copy, Info, Sparkles } from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { aiContext, describeAction, packetSchema, type Packet } from '../../domain/ai';
import { day } from '../../domain/dates';
import { uid } from '../../domain/format';
import { zodMessage } from '../../domain/schemas';
import { IconBadge } from '../common';
import { copyText } from '../download';

const AiModal: ModalComp = () => {
  const { state, me, act, toast, setError } = useHome();
  const [tab, setTab] = useState<'prepare' | 'import'>('prepare');
  const [includeNutrition, setIncludeNutrition] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Packet | null>(null);
  const context = aiContext(state, me.id, includeNutrition);

  const example = () =>
    JSON.stringify(
      {
        version: 1,
        id: uid(),
        baseRevision: state.revision,
        actions: [{ type: 'add_shopping', name: 'Limones', quantity: '3 unidades' }],
      },
      null,
      2,
    );

  return (
    <>
      <div className="ai-modal-title">
        <IconBadge>
          <Sparkles size={23} />
        </IconBadge>
        <div>
          <h2>Una mano con IA</h2>
          <p className="muted">Tu chat favorito. Tu hogar bajo tu control.</p>
        </div>
      </div>
      <div className="segmented large ai-tabs">
        <button className={tab === 'prepare' ? 'selected' : ''} onClick={() => setTab('prepare')}>
          1. Llevar contexto
        </button>
        <button
          className={tab === 'import' ? 'selected' : ''}
          onClick={() => {
            setTab('import');
            setError('');
            setPreview(null);
          }}
        >
          2. Traer propuesta
        </button>
      </div>
      {tab === 'prepare' ? (
        <>
          <p>Copia las instrucciones y el contexto, pégalos en tu IA y cuéntale qué necesitas. Después vuelve con su JSON.</p>
          <div className="context-tags">
            {['Inventario', 'Tuppers', 'Recetas', 'Menú', 'Lista de la compra', 'Kits', 'Personas'].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeNutrition} onChange={(e) => setIncludeNutrition(e.target.checked)} /> Incluir proteína por artículo
          </label>
          <p className="footnote">No se incluyen gastos, campañas, claves ni el historial de comidas. Nada se envía automáticamente.</p>
          <textarea className="json-area context" readOnly value={context} aria-label="Instrucciones y contexto para la IA" />
          <button
            className="button primary full"
            onClick={() =>
              copyText(context)
                .then(() => {
                  setCopied(true);
                  toast('Copiado. Pégalo en tu chat de IA.');
                })
                .catch(() => setError('No se pudo acceder al portapapeles. Selecciona y copia el texto del cuadro.'))
            }
          >
            {copied ? <CheckCheck size={17} /> : <Copy size={17} />} {copied ? 'Contexto copiado' : 'Copiar instrucciones y contexto'}
          </button>
        </>
      ) : (
        <>
          <p>Pega la respuesta. Comprobaremos el formato y podrás revisar cada cambio antes de aplicarlo.</p>
          <textarea
            className="json-area"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
            placeholder={'{"version": 1, "id": "...", "baseRevision": ' + state.revision + ', "actions": [...] }'}
            aria-label="JSON de respuesta de la IA"
          />
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => {
                setText(example());
                setPreview(null);
                setError('');
              }}
            >
              Cargar ejemplo
            </button>
            <button
              className="button primary"
              onClick={() => {
                try {
                  // Muchas IAs envuelven el JSON en ```json ... ```: lo quitamos.
                  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
                  const p = packetSchema.parse(JSON.parse(clean));
                  if (state.applied.includes(p.id)) throw Error('Este JSON ya se ha aplicado.');
                  setPreview(p);
                  setError('');
                } catch (e) {
                  setPreview(null);
                  setError(e instanceof SyntaxError ? 'JSON no válido: revisa llaves, comillas y comas.' : zodMessage(e));
                }
              }}
            >
              Revisar propuesta
            </button>
          </div>
          {preview && (
            <div className="import-preview">
              <h3>
                <CheckCircle2 size={18} /> Propuesta válida
              </h3>
              {preview.baseRevision !== state.revision && (
                <p className="info-strip">
                  <Info size={16} />
                  <span>El hogar ha cambiado desde que copiaste el contexto. Revisa que la propuesta siga teniendo sentido.</span>
                </p>
              )}
              {preview.actions.map((a, i) => (
                <p key={i}>{describeAction(state, a)}</p>
              ))}
              <button
                className="button primary full"
                onClick={() => act({ type: 'ai.packet', packet: preview, ids: preview.actions.map(() => uid()), date: day() }, 'Propuesta aplicada y guardada', true)}
              >
                Aplicar {preview.actions.length} cambio{preview.actions.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
};
AiModal.wide = true;

export const aiModals: Record<string, ModalComp> = { ai: AiModal };
