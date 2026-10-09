import { describe, expect, it } from 'vitest';
import guide from '../../data/grading-guide.json';
import { searchGuide } from '../guideSearch';
import type { GuideDog } from '../../domain/types';

const dogs = (guide as { dogs: GuideDog[] }).dogs;

const dog = (regNo: string, callName: string, breed: string, owner: string): GuideDog =>
  ({ regNo, callName, breed, owner, bwave: null, mwave: null } as unknown as GuideDog);

describe('searchGuide', () => {
  it('puts the dog whose call name you typed first, whatever its breed', () => {
    // The case that was reported: 37 records contain "ava", and in guide order
    // the Windsprite came after the 25 that were shown.
    const hits = searchGuide(dogs, 'ava');
    expect(hits.length).toBeGreaterThan(25);
    expect(hits[0].regNo).toBe('WS-67');
    expect(hits[0].callName).toBe('Ava');
  });

  it('ranks exact, then starts-with, then contains, then reg#, owner, breed', () => {
    const small = [
      dog('X-1', 'Savannah', 'WHIPPET', 'Smith'),
      dog('X-2', 'Rex', 'WHIPPET', 'Gravatt'),
      dog('X-3', 'Avalon', 'WHIPPET', 'Smith'),
      dog('X-4', 'Ava', 'WINDSPRITE', 'Smith'),
      dog('AVA-9', 'Zed', 'AVAWAKH', 'Smith'),
    ];
    expect(searchGuide(small, 'ava').map((d) => d.regNo)).toEqual(['X-4', 'X-3', 'X-1', 'AVA-9', 'X-2']);
  });

  it('finds a dog by registration number exactly', () => {
    expect(searchGuide(dogs, 'ws-67')[0].callName).toBe('Ava');
  });

  it('keeps guide order among equal matches', () => {
    const whippets = searchGuide(dogs, 'whippet');
    const inGuide = dogs.filter((d) => d.breed === 'WHIPPET').map((d) => d.regNo);
    expect(whippets.map((d) => d.regNo)).toEqual(inGuide);
  });

  it('needs two letters', () => {
    expect(searchGuide(dogs, 'a')).toEqual([]);
    expect(searchGuide(dogs, ' ')).toEqual([]);
  });
});
