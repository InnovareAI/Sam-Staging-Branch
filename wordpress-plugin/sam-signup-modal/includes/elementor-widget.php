<?php
/**
 * SAM Signup Button Elementor Widget
 */

if (!defined('ABSPATH')) {
    exit;
}

class SAM_Signup_Button_Widget extends \Elementor\Widget_Base {

    /**
     * Get widget name
     */
    public function get_name() {
        return 'sam_signup_button';
    }

    /**
     * Get widget title
     */
    public function get_title() {
        return __('SAM Signup Button', 'sam-signup-modal');
    }

    /**
     * Get widget icon
     */
    public function get_icon() {
        return 'eicon-button';
    }

    /**
     * Get widget categories
     */
    public function get_categories() {
        return ['general'];
    }

    /**
     * Register widget controls
     */
    protected function register_controls() {

        // Content Section
        $this->start_controls_section(
            'content_section',
            [
                'label' => __('Content', 'sam-signup-modal'),
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'button_text',
            [
                'label' => __('Button Text', 'sam-signup-modal'),
                'type' => \Elementor\Controls_Manager::TEXT,
                'default' => __('Start 14-Day Free Trial', 'sam-signup-modal'),
                'placeholder' => __('Enter button text', 'sam-signup-modal'),
            ]
        );

        $this->end_controls_section();

        // Style Section
        $this->start_controls_section(
            'style_section',
            [
                'label' => __('Style', 'sam-signup-modal'),
                'tab' => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'button_background',
            [
                'label' => __('Background Color', 'sam-signup-modal'),
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#667eea',
            ]
        );

        $this->add_control(
            'button_text_color',
            [
                'label' => __('Text Color', 'sam-signup-modal'),
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#ffffff',
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Typography::get_type(),
            [
                'name' => 'button_typography',
                'label' => __('Typography', 'sam-signup-modal'),
                'selector' => '{{WRAPPER}} .sam-elementor-button',
            ]
        );

        $this->add_responsive_control(
            'button_padding',
            [
                'label' => __('Padding', 'sam-signup-modal'),
                'type' => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => ['px', 'em', '%'],
                'default' => [
                    'top' => 16,
                    'right' => 32,
                    'bottom' => 16,
                    'left' => 32,
                    'unit' => 'px',
                ],
                'selectors' => [
                    '{{WRAPPER}} .sam-elementor-button' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'button_border_radius',
            [
                'label' => __('Border Radius', 'sam-signup-modal'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px'],
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 50,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 8,
                ],
                'selectors' => [
                    '{{WRAPPER}} .sam-elementor-button' => 'border-radius: {{SIZE}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();
    }

    /**
     * Render widget output
     */
    protected function render() {
        $settings = $this->get_settings_for_display();

        ?>
        <button
            onclick="SAMSignup.open()"
            class="sam-elementor-button"
            style="
                background: <?php echo esc_attr($settings['button_background']); ?>;
                color: <?php echo esc_attr($settings['button_text_color']); ?>;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                transition: all 0.3s;
                font-weight: 600;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
        >
            <?php echo esc_html($settings['button_text']); ?>
        </button>
        <?php
    }
}
