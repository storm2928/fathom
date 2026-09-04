/**
 * Bibliographic data for the research page (named studies.ts rather than
 * research.ts because Research.tsx would shadow it on a case-insensitive
 * filesystem). The translatable sentences
 * (finding, how it shapes FATHOM, category titles and intros) live in
 * `strings/research.ts`; only the fields that are the same in every language
 * are here. No study may be added that the verification stage did not
 * confirm, and every DOI and URL must match the source record character for
 * character.
 */
import type { ResearchCategory, StudyId } from './strings';

export type Category = ResearchCategory;
export type { StudyId };

export const CATEGORY_ORDER: Category[] = ['protocol', 'physiology', 'biofeedback', 'clinical', 'access'];

export interface Study {
  id: StudyId;
  category: Category;
  title: string;
  authors: string;
  venue: string;
  year: number;
  doi: string | null;
  url: string;
  /** A second, publisher-provided link (only Linehan's handouts). */
  extraLink?: string;
}

export const STUDIES: Study[] = [
  {
    id: 'balban2023',
    category: 'protocol',
    title: 'Brief structured respiration practices enhance mood and reduce physiological arousal',
    authors:
      'Balban MY, Neri E, Kogon MM, Weed L, Nouriani B, Jo B, Holl G, Zeitzer JM, Spiegel D, Huberman AD',
    venue: 'Cell Reports Medicine',
    year: 2023,
    doi: '10.1016/j.xcrm.2022.100895',
    url: 'https://doi.org/10.1016/j.xcrm.2022.100895',
  },
  {
    id: 'zaccaro2018',
    category: 'physiology',
    title:
      'How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing',
    authors: 'Zaccaro A, Piarulli A, Laurino M, Garbella E, Menicucci D, Neri B, Gemignani A',
    venue: 'Frontiers in Human Neuroscience',
    year: 2018,
    doi: '10.3389/fnhum.2018.00353',
    url: 'https://doi.org/10.3389/fnhum.2018.00353',
  },
  {
    id: 'van-diest-2014',
    category: 'physiology',
    title:
      'Inhalation/Exhalation Ratio Modulates the Effect of Slow Breathing on Heart Rate Variability and Relaxation',
    authors: 'Van Diest I, Verstappen K, Aubert AE, Widjaja D, Vansteenwegen D, Vlemincx E',
    venue: 'Applied Psychophysiology and Biofeedback',
    year: 2014,
    doi: '10.1007/s10484-014-9253-x',
    url: 'https://doi.org/10.1007/s10484-014-9253-x',
  },
  {
    id: 'grassmann-2016',
    category: 'physiology',
    title: 'Respiratory Changes in Response to Cognitive Load: A Systematic Review',
    authors: 'Grassmann M, Vlemincx E, von Leupoldt A, Mittelstädt JM, Van den Bergh O',
    venue: 'Neural Plasticity',
    year: 2016,
    doi: '10.1155/2016/8146809',
    url: 'https://doi.org/10.1155/2016/8146809',
  },
  {
    id: 'russo-2017',
    category: 'physiology',
    title: 'The physiological effects of slow breathing in the healthy human',
    authors: "Russo MA, Santarelli DM, O'Rourke D",
    venue: 'Breathe',
    year: 2017,
    doi: '10.1183/20734735.009817',
    url: 'https://doi.org/10.1183/20734735.009817',
  },
  {
    id: 'lehrer2014',
    category: 'biofeedback',
    title: 'Heart rate variability biofeedback: how and why does it work?',
    authors: 'Lehrer PM, Gevirtz R',
    venue: 'Frontiers in Psychology',
    year: 2014,
    doi: '10.3389/fpsyg.2014.00756',
    url: 'https://doi.org/10.3389/fpsyg.2014.00756',
  },
  {
    id: 'linehan2015',
    category: 'clinical',
    title: 'DBT Skills Training Manual, Second Edition',
    authors: 'Linehan MM',
    venue: 'The Guilford Press',
    year: 2015,
    doi: null,
    url: 'https://www.guilford.com/books/DBT-Skills-Training-Manual/Marsha-Linehan/9781462516995',
    extraLink: 'https://www.guilford.com/add/linehan7_old/lin-p-4teaching.pdf?t=1',
  },
  {
    id: 'asca2026',
    category: 'access',
    title: 'School Counselor Roles & Ratios',
    authors: 'American School Counselor Association',
    venue: 'schoolcounselor.org',
    year: 2026,
    doi: null,
    url: 'https://www.schoolcounselor.org/About-School-Counseling/School-Counselor-Roles-Ratios',
  },
  {
    id: 'eisenberg-2007',
    category: 'access',
    title: 'Help-Seeking and Access to Mental Health Care in a University Student Population',
    authors: 'Eisenberg D, Golberstein E, Gollust SE',
    venue: 'Medical Care',
    year: 2007,
    doi: '10.1097/MLR.0b013e31803bb4c1',
    url: 'https://doi.org/10.1097/MLR.0b013e31803bb4c1',
  },
];
