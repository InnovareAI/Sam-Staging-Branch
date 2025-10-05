<?php
/**
 * Plugin Name: SAM AI Signup Modal
 * Plugin URI: https://innovareai.com
 * Description: Adds SAM AI signup modal to InnovareAI landing pages
 * Version: 1.0.0
 * Author: InnovareAI
 * Author URI: https://innovareai.com
 * License: GPL-2.0+
 * Text Domain: sam-signup-modal
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Main SAM Signup Modal Class
 */
class SAM_Signup_Modal {

    /**
     * Plugin version
     */
    const VERSION = '1.0.0';

    /**
     * Singleton instance
     */
    private static $instance = null;

    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        // Enqueue scripts
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

        // Add shortcode
        add_shortcode('sam_signup_button', array($this, 'signup_button_shortcode'));

        // Add Elementor widget (if Elementor is active)
        add_action('elementor/widgets/widgets_registered', array($this, 'register_elementor_widget'));
    }

    /**
     * Enqueue frontend scripts
     */
    public function enqueue_scripts() {
        // Only load on specific pages (customize as needed)
        if (is_page('sam') || is_front_page()) {
            // Enqueue SAM signup modal script
            wp_enqueue_script(
                'sam-signup-modal',
                'https://app.meet-sam.com/signup/embed.js',
                array(),
                self::VERSION,
                true
            );
        }
    }

    /**
     * Shortcode for signup button
     * Usage: [sam_signup_button text="Start Free Trial" class="custom-class"]
     */
    public function signup_button_shortcode($atts) {
        $atts = shortcode_atts(array(
            'text' => 'Start 14-Day Free Trial',
            'class' => 'sam-cta-button',
            'style' => ''
        ), $atts);

        $default_style = "
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            font-size: 18px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.3s;
        ";

        $style = !empty($atts['style']) ? $atts['style'] : $default_style;

        return sprintf(
            '<button onclick="SAMSignup.open()" class="%s" style="%s" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 6px 20px rgba(102, 126, 234, 0.5)\';" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 4px 12px rgba(102, 126, 234, 0.4)\';">%s</button>',
            esc_attr($atts['class']),
            esc_attr($style),
            esc_html($atts['text'])
        );
    }

    /**
     * Register Elementor widget (if Elementor is active)
     */
    public function register_elementor_widget() {
        if (class_exists('Elementor\Widget_Base')) {
            require_once plugin_dir_path(__FILE__) . 'includes/elementor-widget.php';
            \Elementor\Plugin::instance()->widgets_manager->register_widget_type(new SAM_Signup_Button_Widget());
        }
    }
}

/**
 * Initialize plugin
 */
function sam_signup_modal_init() {
    return SAM_Signup_Modal::get_instance();
}
add_action('plugins_loaded', 'sam_signup_modal_init');

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    // Nothing to do on activation
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    // Nothing to do on deactivation
});
