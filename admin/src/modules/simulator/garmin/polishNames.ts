const PL_FIRST_NAMES = [
    'Piotr', 'Krzysztof', 'Andrzej', 'Tomasz', 'Marcin', 'Michał', 'Jakub',
    'Mateusz', 'Łukasz', 'Rafał', 'Grzegorz', 'Maciej', 'Dawid', 'Adam',
    'Bartosz', 'Damian', 'Karol', 'Szymon', 'Paweł', 'Jan', 'Artur',
    'Kamil', 'Daniel', 'Sebastian', 'Mariusz', 'Robert', 'Wojciech',
    'Radosław', 'Przemysław', 'Jarosław', 'Kacper', 'Kuba',
    'Anna', 'Katarzyna', 'Magdalena', 'Agnieszka', 'Małgorzata', 'Joanna',
    'Marta', 'Natalia', 'Aleksandra', 'Monika', 'Dorota', 'Ewa', 'Karolina',
    'Paulina', 'Justyna', 'Patrycja', 'Barbara', 'Kinga', 'Izabela',
    'Weronika', 'Kamila', 'Martyna', 'Sylwia', 'Agata', 'Klaudia',
];

const PL_LAST_NAMES = [
    'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński',
    'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
    'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
    'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski',
    'Nowicki', 'Adamczyk', 'Dudek', 'Zając', 'Wieczorek', 'Jabłoński',
    'Król', 'Majewski', 'Olszewski', 'Stępień', 'Jaworski', 'Malinowski',
    'Sadowski', 'Walczak', 'Baran', 'Czarnecki', 'Adamski', 'Sikora',
    'Górski', 'Borkowski', 'Rutkowski', 'Ostrowski', 'Szewczyk',
    'Tomaszewski', 'Pietrzak', 'Marciniak', 'Wróblewski', 'Zalewski',
    'Jakubowski', 'Jasiński', 'Bąk', 'Wilk', 'Duda', 'Sikorski',
    'Chmielewski', 'Przybylski', 'Kaźmierczak', 'Włodarczyk',
];

export function generatePolishNames(count: number) {
    const result: Array<{ first: string; last: string; display: string }> = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i += 1) {
        let first: string;
        let last: string;
        do {
            first = PL_FIRST_NAMES[Math.floor(Math.random() * PL_FIRST_NAMES.length)];
            last = PL_LAST_NAMES[Math.floor(Math.random() * PL_LAST_NAMES.length)];
        } while (used.has(`${first} ${last}`));
        used.add(`${first} ${last}`);
        result.push({ first, last, display: `${first} ${last}` });
    }
    return result;
}
