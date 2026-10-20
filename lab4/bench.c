#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

static unsigned int seed_state = 1;

static double random01(void) {
    seed_state = seed_state * 1664525u + 1013904223u;
    return (double)(seed_state >> 8) / 16777216.0;
}

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000.0 + ts.tv_nsec / 1e6;
}

static long long checksum = 0;

static inline void put(int x, int y) {
    checksum += x * 3 + y;
}

static void step_line(int x0, int y0, int x1, int y1) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    if (dx == 0 && dy == 0) {
        put(x0, y0);
        return;
    }
    if (abs(dx) >= abs(dy)) {
        double k = (double)dy / dx;
        double b = y0 - k * x0;
        int s = dx > 0 ? 1 : -1;
        for (int x = x0;; x += s) {
            put(x, (int)floor(k * x + b + 0.5));
            if (x == x1) break;
        }
    } else {
        double k = (double)dx / dy;
        double b = x0 - k * y0;
        int s = dy > 0 ? 1 : -1;
        for (int y = y0;; y += s) {
            put((int)floor(k * y + b + 0.5), y);
            if (y == y1) break;
        }
    }
}

static void dda_line(int x0, int y0, int x1, int y1) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int length = abs(dx) > abs(dy) ? abs(dx) : abs(dy);
    if (length == 0) {
        put(x0, y0);
        return;
    }
    double ix = (double)dx / length;
    double iy = (double)dy / length;
    double x = x0;
    double y = y0;
    for (int i = 0; i <= length; i++) {
        put((int)floor(x + 1e-9), (int)floor(y + 1e-9));
        x += ix;
        y += iy;
    }
}

static void bresenham_line(int x0, int y0, int x1, int y1) {
    int dx = abs(x1 - x0);
    int dy = abs(y1 - y0);
    int sx = x1 >= x0 ? 1 : -1;
    int sy = y1 >= y0 ? 1 : -1;
    int steep = dy > dx;
    if (steep) {
        int t = dx;
        dx = dy;
        dy = t;
    }
    int e = 2 * dy - dx;
    int eStraight = 2 * dy;
    int eDiagonal = 2 * dy - 2 * dx;
    int x = x0;
    int y = y0;
    for (int i = 0; i <= dx; i++) {
        put(x, y);
        if (e > 0) {
            x += sx;
            y += sy;
            e += eDiagonal;
        } else {
            if (steep) y += sy;
            else x += sx;
            e += eStraight;
        }
    }
}

typedef void (*line_fn)(int, int, int, int);

static double run(line_fn fn, int *data, int count, int repeats) {
    double best = 1e18;
    for (int r = 0; r < repeats; r++) {
        double t0 = now_ms();
        for (int i = 0; i < count; i++) fn(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]);
        double t = now_ms() - t0;
        if (t < best) best = t;
    }
    return best;
}

static int *make_segments(int count, double min_len, double max_len) {
    int *data = malloc(sizeof(int) * count * 4);
    double range = 1000 - ceil(max_len);
    for (int i = 0; i < count; i++) {
        double length = min_len + random01() * (max_len - min_len);
        double angle = random01() * 2 * M_PI;
        int x0 = (int)llround((random01() * 2 - 1) * range);
        int y0 = (int)llround((random01() * 2 - 1) * range);
        data[i * 4] = x0;
        data[i * 4 + 1] = y0;
        data[i * 4 + 2] = x0 + (int)llround(length * cos(angle));
        data[i * 4 + 3] = y0 + (int)llround(length * sin(angle));
    }
    return data;
}

int main(void) {
    const char *names[3] = {"step", "dda", "bresenham"};
    line_fn fns[3] = {step_line, dda_line, bresenham_line};
    int *data = make_segments(100000, 10, 500);
    for (int a = 0; a < 3; a++) {
        double t = run(fns[a], data, 100000, 7);
        printf("count100000 %s %.2f\n", names[a], t);
    }
    int lengths[6] = {50, 100, 200, 400, 600, 800};
    for (int l = 0; l < 6; l++) {
        int *set = make_segments(10000, lengths[l], lengths[l]);
        for (int a = 0; a < 3; a++) {
            double t = run(fns[a], set, 10000, 7);
            printf("length%d %s %.3f\n", lengths[l], names[a], t);
        }
        free(set);
    }
    fprintf(stderr, "%lld\n", checksum);
    free(data);
    return 0;
}
