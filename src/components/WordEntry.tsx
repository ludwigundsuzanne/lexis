import { Fragment } from 'react';
import type { Word } from '../data/types';
import { FAMILY_BY_ID, WORD_BY_ID } from '../data/words';
import { href } from '../lib/router';
import { IconWarn } from './Icons';

/** Typographie française : espaces insécables avant : ; ? ! et à l'intérieur des guillemets. */
export function fr(text: string): string {
  return text
    .replace(/« /g, '« ')
    .replace(/ »/g, ' »')
    .replace(/ ([:;?!])/g, ' $1');
}

/** Exemple entre guillemets, sauf s'il est déjà une citation. */
export function quoted(text: string): string {
  return text.trim().startsWith('«') ? text : `« ${text} »`;
}

/** Rend une phrase dont le mot est entre accolades : « une remarque {perspicace} ». */
export function Marked({ text }: { text: string }) {
  const parts = fr(text).split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('{') ? <mark key={i}>{p.slice(1, -1)}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/** Fiche complète, composée comme une entrée de dictionnaire. */
export function WordEntry({ word, knownIds, linkNeighbours = true }: { word: Word; knownIds?: Set<string>; linkNeighbours?: boolean }) {
  const family = FAMILY_BY_ID[word.family];
  const neighbours = family.words.map((id) => WORD_BY_ID[id]);
  return (
    <article className="entry">
      <header className="entry-head">
        <h1 className="entry-word">{word.lemma}</h1>
        <p className="entry-phon">[{word.phon}]</p>
        <p className="entry-gram">
          {word.pos}, <span className="sc">{word.register}</span>.{word.etymology ? ` ${fr(word.etymology)}` : ''}
        </p>
      </header>
      <div className="entry-body">
        <section>
          <p className="label">Définition</p>
          <p className="entry-def">{fr(word.definition)}</p>
          <p className="entry-explain">{fr(word.explanation)}</p>
        </section>
        {word.construction && (
          <section>
            <p className="label">Construction</p>
            <p className="entry-construction">{fr(word.construction)}</p>
          </section>
        )}
        <p className="entry-example">
          <Marked text={quoted(word.example)} />
        </p>
        <section>
          <p className="label">Ne pas confondre</p>
          <div className="nuances">
            {neighbours.map((n) => {
              const known = !knownIds || knownIds.has(n.id) || n.id === word.id;
              const inner = (
                <>
                  <b>
                    {n.lemma}
                    {n.role === 'repère' && <span className="anchor-tag"> repère</span>}
                  </b>
                  <span>{n.nuance}</span>
                </>
              );
              const cls = n.id === word.id ? 'self' : undefined;
              return linkNeighbours && known && n.id !== word.id ? (
                <a key={n.id} className={cls} href={href('mot/' + n.id)}>{inner}</a>
              ) : (
                <div key={n.id} className={cls} style={{ display: 'grid', gap: 1 }}>{inner}</div>
              );
            })}
          </div>
        </section>
        <div className="entry-cols">
          <div>
            <p className="label">Synonymes</p>
            {word.synonyms.join(', ')}
          </div>
          <div>
            <p className="label">Contraires</p>
            {word.antonyms.join(', ')}
          </div>
        </div>
        {word.pitfall && (
          <p className="pitfall">
            <IconWarn />
            <span>{fr(word.pitfall)}</span>
          </p>
        )}
        {word.source ? (
          <p className="source">
            Définition adaptée du{' '}
            <a href={word.source.url} target="_blank" rel="noreferrer">
              Wiktionnaire
            </a>{' '}
            (CC BY-SA).
          </p>
        ) : null}
      </div>
    </article>
  );
}
