/** The site's calculators beyond the main one, in the order the header, home page and footer list them. */
export interface Tool {
  href: string;
  label: string;
  text: string;
  icon: string;
  isNew: boolean;
}

export const TOOLS: Tool[] = [
  {
    href: '/in-hand-to-ctc-calculator',
    label: 'In-hand to CTC',
    text: 'The CTC to ask for, from the salary you want each month',
    icon: 'lucide:arrow-left-right',
    isNew: true,
  },
  {
    href: '/compare-offers',
    label: 'Compare job offers',
    text: 'Two offers side by side: which puts more in your bank',
    icon: 'lucide:git-compare-arrows',
    isNew: false,
  },
  {
    href: '/salary-hike-calculator',
    label: 'Salary hike calculator',
    text: 'What a raise adds to your monthly pay',
    icon: 'lucide:trending-up',
    isNew: false,
  },
  {
    href: '/gratuity-calculator',
    label: 'Gratuity calculator',
    text: 'On Labour Code wages, from one year for fixed-term',
    icon: 'lucide:hand-coins',
    isNew: false,
  },
];
