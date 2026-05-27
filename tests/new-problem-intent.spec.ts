import { describe, expect, it } from 'vitest';

import { wantsNewProblem } from '../src/ui/new-problem-intent';

describe('wantsNewProblem', () => {
  describe('casos positivos', () => {
    it('detecta intencion explicita de iniciar otro escenario', () => {
      const positives = [
        'quiero resolver otro problema',
        'tengo otro ejercicio',
        'nuevo modelo',
        'quiero desarrollar otro caso',
        'ahora quiero resolver otro problema',
      ];

      for (const text of positives) {
        expect(wantsNewProblem(text)).toBe(true);
      }
    });

    it('tolera mayusculas, tildes y puntuacion', () => {
      const positives = [
        'QUIERO RESOLVER OTRO PROBLEMA',
        'Quiero resolver otro problema!!!',
        'NUEVO MODELO.',
        'Quiero desarrollar OTRO CASO, por favor.',
      ];

      for (const text of positives) {
        expect(wantsNewProblem(text)).toBe(true);
      }
    });
  });

  describe('casos negativos', () => {
    it('evita falsos positivos dentro del mismo problema', () => {
      const negatives = [
        'otro costo del mismo problema',
        'quiero seguir con este ejercicio',
        'tengo otro dato',
        'otro periodo tiene demanda distinta',
        'quiero modificar este modelo',
      ];

      for (const text of negatives) {
        expect(wantsNewProblem(text)).toBe(false);
      }
    });

    it('descarta entradas vacias o ambiguas', () => {
      const negatives = [
        '',
        '   ',
        'otro',
        'nuevo',
        'quiero resolver',
      ];

      for (const text of negatives) {
        expect(wantsNewProblem(text)).toBe(false);
      }
    });
  });
});
