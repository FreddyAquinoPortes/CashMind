-- Fix legacy icon names that were stored without the tabler: prefix
UPDATE "Categoria" SET icono = 'tabler:home'             WHERE icono = 'home';
UPDATE "Categoria" SET icono = 'tabler:shopping-cart'    WHERE icono = 'shopping-cart';
UPDATE "Categoria" SET icono = 'tabler:car'              WHERE icono = 'car';
UPDATE "Categoria" SET icono = 'tabler:credit-card'      WHERE icono = 'credit-card';
UPDATE "Categoria" SET icono = 'tabler:school'           WHERE icono = 'book';
UPDATE "Categoria" SET icono = 'tabler:users'            WHERE icono = 'users';
UPDATE "Categoria" SET icono = 'tabler:user-circle'      WHERE icono = 'user';
UPDATE "Categoria" SET icono = 'tabler:device-laptop'    WHERE icono = 'monitor';
UPDATE "Categoria" SET icono = 'tabler:trending-up'      WHERE icono = 'trending-up';
UPDATE "Categoria" SET icono = 'tabler:alert-triangle'   WHERE icono = 'alert-triangle';
UPDATE "Categoria" SET icono = 'tabler:receipt-tax'      WHERE icono = 'receipt';
UPDATE "Categoria" SET icono = 'tabler:arrows-exchange'  WHERE icono = 'arrows-exchange';
UPDATE "Categoria" SET icono = 'tabler:plug'             WHERE icono = 'plug';
UPDATE "Categoria" SET icono = 'tabler:device-gamepad-2' WHERE icono = 'gamepad';
