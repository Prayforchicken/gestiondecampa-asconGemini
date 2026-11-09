// Hoy: lo importante de un vistazo, para la persona que usa este dispositivo.
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Backpack, BriefcaseBusiness, ChevronRight, Clock, Heart, Info, Leaf, Plus, Sparkles, Box, Wallet } from 'lucide-react';
import { useHome } from '../../app/context';
import { day, fmtDate, fromNow, relative } from '../../domain/dates';
import { euros, qty } from '../../domain/format';
import { pendingDues, visibleKits } from '../../domain/kits';
import { balances, settleUp } from '../../domain/money';
import { Empty, PageHeading } from '../common';
import { MealCard, nextMeals, tuppersInStock } from './Kitchen';
import { isUrgent } from './Inventory';

export function TodayPage() {
  const { state, me, members, open, go, nameOf } = useHome();
  const [person, setPerson] = useState(me.id);
  const meals = nextMeals(state);
  const stock = tuppersInStock(state);
  const urgent = state.items.filter((i) => isUrgent(i) && (!i.owner || i.owner === me.id)).sort((a, b) => a.expires.localeCompare(b.expires));
  const dues = pendingDues(visibleKits(state.kits, me.id));
  const today = day();
  const tasks = state.campaigns
    .filter((c) => c.owner === me.id && c.status !== 'Terminada')
    .flatMap((c) => c.tasks.filter((t) => !t.completed && t.due && t.due <= day(1)).map((t) => ({ c, t })))
    .sort((a, b) => a.t.due!.localeCompare(b.t.due!));
  const myTransfers = settleUp(balances(state)).filter((t) => t.from === me.id || t.to === me.id);

  // Proteína registrada en los últimos 7 días para la persona elegida.
  const p = members.find((m) => m.id === person) ?? me;
  const days = Array.from({ length: 7 }, (_, i) => day(i - 6));
  const daily = days.map((d) => state.consumptions.filter((c) => c.person === p.id && c.date === d).reduce((a, c) => a + c.protein, 0));
  const avg = daily.reduce((a, v) => a + v, 0) / 7;
  const target = p.proteinTarget ?? 0;
  const scale = target || Math.max(60, ...daily);
  const hasData = daily.some((v) => v > 0);

  return (
    <>
      <PageHeading
        overline={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Hola, ${me.name}`}
        subtitle="Un hogar bien cuidado."
        action={
          <button className="button primary compact" onClick={() => open('entry')}>
            <Plus size={17} />
            <span>Añadir</span>
          </button>
        }
      />
      <div className="today-grid">
        <section className="main-column">
          <div className="block-title first">
            <h2>Las próximas comidas</h2>
            <button className="text-button" onClick={() => go('cocina', 'plan')}>
              Ver plan <ChevronRight size={15} />
            </button>
          </div>
          <div className="meal-grid">
            {meals.slice(0, 2).map((m, i) => (
              <MealCard key={m.id} meal={m} index={i} />
            ))}
            {meals.length === 0 && <Empty title="Todo al día" body="Planifica vuestra próxima comida desde Cocina." />}
          </div>

          <section className="nutrition card spaced-card">
            <div className="section-title">
              <div>
                <span className="section-icon pink">
                  <Heart size={17} />
                </span>
                <h2>Cómo vamos comiendo</h2>
              </div>
              <button className="text-button" onClick={() => open('nutrition')}>
                Ver detalle <ChevronRight size={15} />
              </button>
            </div>
            <div className="nutrition-top">
              <div>
                <p className="muted tiny">ÚLTIMOS 7 DÍAS · PROTEÍNA</p>
                {members.length > 1 && (
                  <div className="segmented">
                    {members.map((m) => (
                      <button className={person === m.id ? 'selected' : ''} key={m.id} onClick={() => setPerson(m.id)}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!target && <span className="pill neutral">Sin objetivo</span>}
            </div>
            <div className="nutrition-body">
              <div className="ring" style={{ ['--progress' as string]: `${target ? Math.min(avg / target, 1) * 360 : 0}deg` }}>
                <div>
                  <strong>
                    {target ? Math.round((avg / target) * 100) : Math.round(avg)}
                    <small>{target ? '%' : 'g'}</small>
                  </strong>
                  <span>{target ? 'del objetivo' : 'media diaria'}</span>
                </div>
              </div>
              <div className="nutri-values">
                <div className="nutri-main">
                  <strong>
                    {Math.round(avg)} <span>g / día</span>
                  </strong>
                  <small>{target ? `Objetivo de ${p.name}: ${target} g` : 'Media registrada al repartir platos'}</small>
                </div>
                <div className="bar-chart" aria-label="Proteína registrada durante los últimos siete días">
                  {days.map((d, i) => (
                    <div className="bar-col" key={d} title={`${fmtDate(d)}: ${Math.round(daily[i])} g`}>
                      <div className="bar-track">
                        <div className={i === 6 ? 'today-bar' : ''} style={{ height: `${Math.min((daily[i] / scale) * 100, 100)}%` }} />
                      </div>
                      <span>{new Date(d + 'T12:00').toLocaleDateString('es-ES', { weekday: 'narrow' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="nutrition-foot">
              <Info size={14} />
              <span>{hasData ? 'Orientativo: cuenta lo registrado al servir. No es una pauta nutricional.' : 'Aún no hay platos registrados. Al servir un tupper se anotan aquí.'}</span>
            </div>
          </section>

          <button className="ai-banner" onClick={() => open('ai')}>
            <span className="sparkle-art">
              <Sparkles size={24} />
            </span>
            <div>
              <strong>¿Y si aprovechamos lo que ya tenemos?</strong>
              <p>Prepara un contexto y llévalo a tu IA favorita.</p>
            </div>
            <ArrowUpRight size={21} />
          </button>
        </section>

        <aside className="right-column">
          {dues.length > 0 && (
            <section className="card alert-card">
              <div className="section-title">
                <div>
                  <span className="section-icon amber">
                    <Backpack size={17} />
                  </span>
                  <h2>Revisiones pendientes</h2>
                </div>
                <span className="count-badge">{dues.length}</span>
              </div>
              {dues.slice(0, 4).map((d) => (
                <button className="alert-row" key={`${d.kitId}-${d.itemId}-${d.kind}`} onClick={() => go('kits', d.kitId)}>
                  <span>{d.kitEmoji}</span>
                  <div>
                    <strong>{d.label}</strong>
                    <small>{d.kitName}</small>
                  </div>
                  <span className={'pill ' + (d.health === 'overdue' ? 'red' : 'orange')}>{d.kind === 'missing' ? 'Falta' : d.date < today ? 'Vencido' : fromNow(d.date)}</span>
                </button>
              ))}
              <button className="wide-link" onClick={() => go('kits')}>
                Ver kits <ArrowRight size={15} />
              </button>
            </section>
          )}

          <section className="card tupper-summary">
            <div className="section-title">
              <div>
                <span className="section-icon orange">
                  <Box size={18} />
                </span>
                <h2>Tuppers primero</h2>
              </div>
              <span className="count-badge">{stock.length}</span>
            </div>
            <p className="section-caption">Comida resuelta. Menos que hacer.</p>
            {stock.slice(0, 3).map((t) => (
              <button key={t.id} className="tupper-row" onClick={() => open('tupper', { tupperId: t.id })}>
                <span className="food-tile">{t.emoji}</span>
                <span>
                  <strong>{t.name}</strong>
                  <small>
                    {qty(t.grams)} g · {t.place}
                  </small>
                  <em className={t.review <= day(1) && t.place === 'Nevera' ? 'urgent' : 'muted'}>
                    {t.place === 'Congelador' ? 'Congelado' : t.review <= today ? 'Revisar hoy' : `Revisar ${relative(t.review).toLowerCase()}`}
                  </em>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!stock.length && <p className="muted">No hay tuppers ahora mismo.</p>}
            <button className="wide-link" onClick={() => go('cocina')}>
              Ver todos los tuppers <ArrowRight size={15} />
            </button>
          </section>

          <section className="card urgent-card">
            <div className="section-title">
              <div>
                <span className="section-icon amber">
                  <Clock size={17} />
                </span>
                <h2>Úsalo pronto</h2>
              </div>
            </div>
            <p className="section-caption">Estos lotes tienen prioridad.</p>
            {urgent.slice(0, 3).map((i) => (
              <button className="urgent-row" key={i.id} onClick={() => open('item', { itemId: i.id })}>
                <span>{i.emoji}</span>
                <div>
                  <strong>{i.name}</strong>
                  <small>
                    {qty(i.qty)} {i.unit}
                  </small>
                </div>
                <span className="pill orange">{relative(i.expires)}</span>
              </button>
            ))}
            {!urgent.length && <p className="muted">Ningún lote próximo a su fecha.</p>}
            <button className="text-button" onClick={() => go('inventario')}>
              Revisar inventario <ChevronRight size={14} />
            </button>
          </section>

          {tasks.length > 0 && (
            <section className="card alert-card">
              <div className="section-title">
                <div>
                  <span className="section-icon blue">
                    <BriefcaseBusiness size={17} />
                  </span>
                  <h2>Trabajo para hoy</h2>
                </div>
                <span className="count-badge">{tasks.length}</span>
              </div>
              {tasks.slice(0, 4).map(({ c, t }) => (
                <button className="alert-row" key={t.id} onClick={() => go('campanas')}>
                  <span>📣</span>
                  <div>
                    <strong>{t.description}</strong>
                    <small>{c.name}</small>
                  </div>
                  <span className={'pill ' + (t.due! < today ? 'red' : 'orange')}>{relative(t.due!)}</span>
                </button>
              ))}
            </section>
          )}

          {myTransfers.length > 0 && (
            <section className="card alert-card">
              <div className="section-title">
                <div>
                  <span className="section-icon green">
                    <Wallet size={17} />
                  </span>
                  <h2>Cuentas</h2>
                </div>
              </div>
              {myTransfers.map((t) => (
                <button className="alert-row" key={t.from + t.to} onClick={() => go('gastos')}>
                  <span>{t.from === me.id ? '↗️' : '↘️'}</span>
                  <div>
                    <strong>{t.from === me.id ? `Debes ${euros(t.amount)} a ${nameOf(t.to)}` : `${nameOf(t.from)} te debe ${euros(t.amount)}`}</strong>
                    <small>Toca para registrar el pago</small>
                  </div>
                </button>
              ))}
            </section>
          )}

          <div className="quiet-note">
            <Leaf size={17} />
            <p>Lo que ya tienes es el mejor punto de partida.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
